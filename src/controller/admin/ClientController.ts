import { ClientModel } from '../../models/shema/auth/Client';
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { NotFound } from '../../Errors/NotFound';
import { SuccessResponse } from '../../utils/response';
import { PackageModel } from '../../models/shema/auth/Package';
import { UniqueConstrainError } from '../../Errors';
import {
  deleteSubdomain,
  sanitizeSubdomainName,
  validateSubdomainName,
} from '../../utils/PleskService';
import {
  provisionNewClient,
  rebuildFrontendForClient,
  deployBackendForClient,
  generateBackendEnv,
  getPleskSystemUser
} from '../../utils/ClientProvisioner';
import { executePleskCli } from '../../utils/PleskService';

export const getAllClients = asyncHandler(async (req, res) => {
  const clients = await ClientModel.find()
    .select('-password')
    .sort({ created_at: -1 })
    .populate('package_id');

  return SuccessResponse(res, { message: 'Clients retrieved successfully', data: clients }, 200);
});

export const getClientById = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findOne({ _id: id })
    .populate('package_id');

  if (!client) {
    throw new NotFound('Client not found');
  }

  return SuccessResponse(res, { message: 'Client retrieved successfully', data: client }, 200);
});

export const createClient = asyncHandler(async (req, res) => {
  const { company_name, email, password, status, package_id, subdomain, logoBase64 } = req.body;

  // --- Validate package ---
  const existingPackage = await PackageModel.findById(package_id);
  if (!existingPackage) {
    throw new NotFound('Package not found');
  }

  // --- Validate email uniqueness ---
  const existingClient = await ClientModel.findOne({ email });
  if (existingClient) {
    throw new UniqueConstrainError('Client with this email already exists');
  }

  // --- Validate & sanitize subdomain ---
  const validationError = validateSubdomainName(subdomain);
  if (validationError) {
    throw new UniqueConstrainError(validationError);
  }

  const sanitizedSubdomain = sanitizeSubdomainName(subdomain);

  // Check if subdomain is already taken
  const existingSubdomain = await ClientModel.findOne({ subdomain: sanitizedSubdomain });
  if (existingSubdomain) {
    throw new UniqueConstrainError(`Subdomain "${sanitizedSubdomain}.systego.net" is already taken`);
  }

  // --- Create the client record ---
  const client = await ClientModel.create({
    company_name,
    email,
    password,
    status,
    package_id,
    subdomain: sanitizedSubdomain,
  });

  const dbName = `sc_${client._id}`;

  // --- Create the client's MongoDB database ---
  try {
    const newDbConnection = mongoose.connection.useDb(dbName, { useCache: true });

    // 1. Create system metadata
    await newDbConnection.createCollection('metadata');
    await newDbConnection.collection('metadata').insertOne({
      created_at: new Date(),
      client_id: client._id,
      company_name: client.company_name,
    });

    // 1. The Admin schema uses the 'users' collection
    const targetCollection = 'users';
    await newDbConnection.createCollection(targetCollection);

    let initialPasswordHash = password;
    try {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      initialPasswordHash = await bcrypt.hash(password, salt);
    } catch (e) {
      console.warn("Could not hash password for initial seed", e);
    }

    // 2. Match the Admin Schema keys perfectly
    await newDbConnection.collection(targetCollection).insertOne({
      username: 'admin',                 // Required by Admin Schema
      email: email,                      // Required by Admin Schema
      password_hash: initialPasswordHash,// Admin Schema uses password_hash
      company_name: company_name,        // Optional in Admin Schema
      phone: "0000000000",               // Ensure this matches any frontend requirements
      role: 'superadmin',                // Admin Schema enum
      status: 'active',                  // Admin Schema enum
      permissions: [],                   // Default empty permissions array
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`Database ${dbName} created and seeded with compliant superadmin`);
  } catch (error: any) {
    console.error('Failed to create client database:', error);
    // Rollback: delete the client record
    await ClientModel.findByIdAndDelete(client._id);
    throw new Error(`Failed to create client database: ${error.message || error}. Client creation rolled back.`);
  }

  // --- Provision the Client (Create Subdomains & Copy Files) ---
  let frontendUrl: string;
  let backendApiUrl: string;
  try {
    const provisionResult = await provisionNewClient(sanitizedSubdomain, {
      dbName: dbName,
      // Note: In MongoDB Atlas, you typically use a single database user 
      // with access to all databases. We pass the default user from ENV here 
      // if you don't generate separate users per client in Atlas.
      dbUser: process.env.MONGO_USER || 'SystegoSuper',
      dbPass: process.env.MONGO_PASS || 'XEjjaEHrFQwKWrXV'
    }, logoBase64);

    frontendUrl = provisionResult.frontendUrl;
    backendApiUrl = provisionResult.backendApiUrl;
    console.log(`Subdomains provisioned: Frontend=${frontendUrl}, Backend=${backendApiUrl}`);
  } catch (error: any) {
    console.error('Failed to provision client in Plesk:', error.message);
    // Rollback: delete the client record and database
    await ClientModel.findByIdAndDelete(client._id);
    try {
      await mongoose.connection.useDb(dbName, { useCache: true }).dropDatabase();
    } catch (dbError) {
      console.error('Failed to rollback database:', dbError);
    }

    res.status(500).json({
      success: false,
      message: `Failed to provision client in Plesk: ${error.message}`
    });
    return;
  }

  // --- Update client with db_name and subdomain URLs ---
  client.db_name = dbName;
  client.subdomain_url = frontendUrl; // Save the frontend URL as the main one
  // You might want to add client.backend_url = backendApiUrl; in your schema future
  await client.save();

  // Strip sensitive info before returning
  const clientResponse = client.toObject() as any;
  delete clientResponse.admin_password;
  delete clientResponse.password;

  return SuccessResponse(res, { message: 'Client created successfully', data: clientResponse }, 201);
});

export const updateClient = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const updateData = req.body;

  // Prevent subdomain changes (subdomain is immutable after creation)
  if (updateData.subdomain || updateData.subdomain_url) {
    delete updateData.subdomain;
    delete updateData.subdomain_url;
  }

  const client = await ClientModel.findOneAndUpdate(
    { _id: id },
    updateData,
    { new: true, runValidators: true }
  ).populate('package_id');

  if (!client) {
    throw new NotFound('Client not found');
  }

  return SuccessResponse(res, { message: 'Client updated successfully', data: client }, 200);
});

export const deleteClient = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findById(id);

  if (!client) {
    throw new NotFound('Client not found');
  }

  // --- Delete the Plesk subdomain ---
  if (client.subdomain) {
    try {
      await deleteSubdomain(client.subdomain);
      console.log(`Subdomain ${client.subdomain_url} deleted from Plesk`);
    } catch (error: any) {
      console.error('Failed to delete subdomain from Plesk:', error.message);
      // Continue with client deletion even if subdomain removal fails
      // The admin can manually clean it up in Plesk if needed
    }
  }

  // --- Drop the client's MongoDB database ---
  if (client.db_name) {
    try {
      await mongoose.connection.useDb(client.db_name, { useCache: true }).dropDatabase();
      console.log(`Database ${client.db_name} dropped`);
    } catch (error) {
      console.error('Failed to drop client database:', error);
    }
  }

  // --- Delete the client record ---
  await ClientModel.findByIdAndDelete(id);

  return SuccessResponse(res, { message: 'Client deleted successfully', data: client }, 200);
});

export const getClientsByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;
  const clients = await ClientModel.find({ status })
    .sort({ created_at: -1 })
    .populate('package_id');

  return SuccessResponse(res, { message: `Clients with status ${status} retrieved successfully`, data: clients }, 200);
});

export const rebuildClientFrontend = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findById(id);

  if (!client) {
    throw new NotFound('Client not found');
  }

  if (!client.subdomain) {
    res.status(400).json({ success: false, message: 'Client has no subdomain' });
    return;
  }

  try {
    await rebuildFrontendForClient(client.subdomain);
    return SuccessResponse(res, { message: 'Frontend rebuilt successfully' }, 200);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to rebuild frontend', error: error.message });
  }
});

export const deployClientBackend = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findById(id);

  if (!client) {
    throw new NotFound('Client not found');
  }

  if (!client.subdomain) {
    res.status(400).json({ success: false, message: 'Client has no subdomain' });
    return;
  }
  try {
    const path = require('path');
    const PLESK_VHOSTS_DIR = process.env.PLESK_VHOSTS_DIR || '/var/www/vhosts/systego.net/subdomains';
    const backendDestDir = path.join(PLESK_VHOSTS_DIR, `api-${client.subdomain}`);
    const backendSubdomainUrl = `api-${client.subdomain}.systego.net`;

    // This process takes time to run npm install and configure Plesk
    await deployBackendForClient(client.subdomain, backendSubdomainUrl, backendDestDir);
    return SuccessResponse(res, { message: 'Backend Node.js application deployed and restarted successfully' }, 200);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to deploy backend on Plesk', error: error.message });
  }
});

export const regenerateClientEnv = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findById(id);

  if (!client) {
    throw new NotFound('Client not found');
  }

  if (!client.subdomain) {
    res.status(400).json({ success: false, message: 'Client has no subdomain' });
    return;
  }

  try {
    const path = require('path');
    const PLESK_VHOSTS_DIR = process.env.PLESK_VHOSTS_DIR || '/var/www/vhosts/systego.net/subdomains';
    const backendDestDir = path.join(PLESK_VHOSTS_DIR, `api-${client.subdomain}`);
    const frontendUrl = `${client.subdomain}.systego.net`;
    const dbName = `sc_${client._id}`;

    // Regenerate the .env file with corrected line endings
    await generateBackendEnv(backendDestDir, client.subdomain, frontendUrl, {
      dbName,
      dbUser: 'SystegoSuper',
      dbPass: 'XEjjaEHrFQwKWrXV'
    });

    // Restart the Node.js app to pick up new env
    const apiSubdomain = `api-${client.subdomain}.systego.net`;
    await executePleskCli('extension', ['--call', 'nodejs', '--disable', '-domain', apiSubdomain]);
    await executePleskCli('extension', ['--call', 'nodejs', '--enable', '-domain', apiSubdomain]);

    return SuccessResponse(res, { message: 'Backend .env regenerated and app restarted successfully' }, 200);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to regenerate .env', error: error.message });
  }
});

export const select = asyncHandler(async (req, res) => {
  const packages = await PackageModel.find()
    .select('name')
    .sort({ created_at: -1 });

  return SuccessResponse(res, { message: 'Packages retrieved successfully', data: packages }, 200);
});