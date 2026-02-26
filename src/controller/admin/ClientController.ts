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
  deployBackendForClient
} from '../../utils/ClientProvisioner';

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

    // 2. Seed the initial Super Admin user so the client can log in
    await newDbConnection.createCollection('users');

    // Generate hashed password for the initial admin
    let initialPasswordHash = password; // fallback
    try {
      // Assuming bcrypt is used in your system
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      initialPasswordHash = await bcrypt.hash(password, salt);
    } catch (e) {
      console.warn("Could not hash password for initial seed, using plain text fallback.", e);
    }

    await newDbConnection.collection('users').insertOne({
      username: 'admin', // Default username
      email: email,      // The email they registered with
      password_hash: initialPasswordHash,
      company_name: company_name,
      role: 'superadmin',
      status: 'active',
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`Database ${dbName} created via useDb and seeded with initial superadmin`);
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
      dbUser: process.env.MONGO_USER || 'systego',
      dbPass: process.env.MONGO_PASS || 'Systego3030'
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

  return SuccessResponse(res, { message: 'Client created successfully', data: client }, 201);
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
    // This process takes 1-2 minutes to run npm install and configure Plesk
    await deployBackendForClient(client.subdomain);
    return SuccessResponse(res, { message: 'Backend Node.js application deployed and restarted successfully' }, 200);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to deploy backend on Plesk', error: error.message });
  }
});


export const select = asyncHandler(async (req, res) => {
  const packages = await PackageModel.find()
    .select('name')
    .sort({ created_at: -1 });

  return SuccessResponse(res, { message: 'Packages retrieved successfully', data: packages }, 200);
});