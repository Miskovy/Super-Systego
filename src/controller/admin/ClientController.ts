import { ClientModel } from '../../models/schema/auth/Client';
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { NotFound } from '../../Errors/NotFound';
import { SuccessResponse } from '../../utils/response';
import { PackageModel } from '../../models/schema/auth/Package';
import { UniqueConstrainError } from '../../Errors';
import crypto from 'crypto';
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
import { TenantApiKeyModel } from '../../models/schema/auth/TenantApiKey';

export const getAllClients = asyncHandler(async (req, res) => {
  const clients = await ClientModel.find()
    .select('-password -logoBase64 -admin_password') // Exclude heavy payloads & secrets
    .sort({ created_at: -1 })
    .populate({
      path: 'package_id',
      select: 'name price features' // Only get necessary package details
    });

  return SuccessResponse(res, { message: 'Clients retrieved successfully', data: clients }, 200);
});

export const getClientById = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findOne({ _id: id })
    .select('-password')
    .populate('package_id');

  if (!client) {
    throw new NotFound('Client not found');
  }

  const clientResponse = client.toObject() as any;

  return SuccessResponse(res, { message: 'Client retrieved successfully', data: clientResponse }, 200);
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
    logoBase64,
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
      dbUser: process.env.MONGO_USER || 'admin',
      dbPass: encodeURIComponent(process.env.MONGO_PASS || 'MONGO@3030')
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

  // --- Generate Tenant API Key for secure Super Systego communication ---
  let rawApiKey: string | undefined;
  try {
    rawApiKey = `sk_${crypto.randomUUID()}_${crypto.randomBytes(16).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(rawApiKey).digest('hex');

    await TenantApiKeyModel.create({
      client_id: client._id,
      hashedKey,
      label: 'default',
      active: true,
    });

    console.log(`[Provisioning] Tenant API key generated for client: ${client.company_name}`);
  } catch (apiKeyError: any) {
    console.error('Failed to generate tenant API key:', apiKeyError.message);
    // Non-fatal: client is created, key can be regenerated later
  }

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

  let logoBase64 = null;
  if (updateData.logoBase64) {
    logoBase64 = updateData.logoBase64;
    // We do NOT delete it from updateData because we want it updated in the DB
  }

  const client = await ClientModel.findOneAndUpdate(
    { _id: id },
    updateData,
    { new: true, runValidators: true }
  ).select('-password').populate('package_id');

  if (!client) {
    throw new NotFound('Client not found');
  }

  if (logoBase64 && client.subdomain) {
    const { updateClientLogo } = require('../../utils/ClientProvisioner');
    await updateClientLogo(client.subdomain, logoBase64);
  }

  return SuccessResponse(res, { message: 'Client updated successfully', data: client }, 200);
});

export const deleteClient = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findById(id);

  if (!client) {
    throw new NotFound('Client not found');
  }

  // --- Delete the Plesk subdomains ---
  if (client.subdomain) {
    try {
      await deleteSubdomain(client.subdomain);
      console.log(`Frontend subdomain ${client.subdomain_url} deleted from Plesk`);

      // Also delete the backend subdomain
      const backendSubdomain = `api-${client.subdomain}`;
      await deleteSubdomain(backendSubdomain);
      console.log(`Backend subdomain ${backendSubdomain}.systego.net deleted from Plesk`);
    } catch (error: any) {
      console.error('Failed to delete subdomains from Plesk:', error.message);
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

  return SuccessResponse(res, { message: 'Client deleted successfully' }, 200);
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
      dbUser: process.env.MONGO_USER || 'admin',
      dbPass: encodeURIComponent(process.env.MONGO_PASS || 'MONGO@3030')
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

export const installClientSsl = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findById(id);

  if (!client || !client.subdomain) {
    throw new NotFound('Client or subdomain not found');
  }

  const frontendSubdomainUrl = `${client.subdomain}.systego.net`;
  const backendSubdomainUrl = `api-${client.subdomain}.systego.net`;

  console.log(`[SSL API] Starting SSL installation for client: ${client.company_name}`);

  try {
    const { executePleskCli } = require('../../utils/PleskService');
    const adminEmail = process.env.SSL_ADMIN_EMAIL || 'systego.eg@gmail.com';

    // Wait 10 seconds for Plesk to fully write Apache/Nginx configs if called immediately after creation
    console.log(`[SSL API] Waiting 10 seconds for Web Server configuration to reload...`);
    const { setTimeout } = require('timers/promises');
    await setTimeout(10000);

    console.log(`[SSL API] Installing Let's Encrypt SSL for ${frontendSubdomainUrl}...`);
    await executePleskCli('extension', [
      '--exec', 'letsencrypt',
      'cli.php',
      '-d', frontendSubdomainUrl,
      '-m', adminEmail
    ]);

    console.log(`[SSL API] Installing Let's Encrypt SSL for ${backendSubdomainUrl}...`);
    await executePleskCli('extension', [
      '--exec', 'letsencrypt',
      'cli.php',
      '-d', backendSubdomainUrl,
      '-m', adminEmail
    ]);

    SuccessResponse(res, { message: 'SSL certificates successfully installed' }, 200);
  } catch (error: any) {
    console.error('[SSL API] Failed to install SSL:', error);
    res.status(500).json({
      success: false,
      message: `Failed to install SSL certificates: ${error.message}`
    });
  }
});

export const viewSelection = asyncHandler(async (req, res) => {
  const packages = await PackageModel.find();

  return SuccessResponse(res, { message: 'Packages retrieved successfully', data: packages }, 200);
});

/**
 * POST /api/admin/clients/:id/regenerate-api-key
 * 
 * Revokes the old API key and generates a new one.
 * The new raw key is returned ONCE — it must be stored securely.
 */
export const regenerateApiKey = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findById(id);

  if (!client) {
    throw new NotFound('Client not found');
  }

  // Revoke all existing active keys for this client
  await TenantApiKeyModel.updateMany(
    { client_id: client._id, active: true },
    { $set: { active: false } }
  );

  // Generate a new key
  const rawApiKey = `sk_${crypto.randomUUID()}_${crypto.randomBytes(16).toString('hex')}`;
  const hashedKey = crypto.createHash('sha256').update(rawApiKey).digest('hex');

  await TenantApiKeyModel.create({
    client_id: client._id,
    hashedKey,
    label: 'regenerated',
    active: true,
  });

  // If the client has a subdomain, update the .env on the server
  if (client.subdomain) {
    try {
      const path = require('path');
      const PLESK_VHOSTS_DIR = process.env.PLESK_VHOSTS_DIR || '/var/www/vhosts/systego.net/subdomains';
      const backendDestDir = path.join(PLESK_VHOSTS_DIR, `api-${client.subdomain}`);
      const frontendUrl = `${client.subdomain}.systego.net`;
      const dbName = client.db_name || `sc_${client._id}`;

      await generateBackendEnv(backendDestDir, client.subdomain, frontendUrl, {
        dbName,
        dbUser: process.env.MONGO_USER || 'admin',
        dbPass: encodeURIComponent(process.env.MONGO_PASS || 'MONGO@3030')
      }, rawApiKey);

      // Restart the Node.js app to pick up the new env
      const apiSubdomain = `api-${client.subdomain}.systego.net`;
      await executePleskCli('extension', ['--call', 'nodejs', '--disable', '-domain', apiSubdomain]);
      await executePleskCli('extension', ['--call', 'nodejs', '--enable', '-domain', apiSubdomain]);

      console.log(`[API Key] Updated .env and restarted backend for ${client.company_name}`);
    } catch (envError: any) {
      console.error(`[API Key] Failed to update .env on server: ${envError.message}`);
      // Still return the key — admin can manually update the .env
    }
  }

  return SuccessResponse(res, {
    message: 'API key regenerated successfully. Store this key securely — it will not be shown again.',
    data: { apiKey: rawApiKey }
  }, 200);
});

/**
 * POST /api/admin/clients/generate-all-api-keys
 * 
 * One-time migration: Generates API keys for ALL existing clients
 * that don't have an active key yet.
 * 
 * Returns the raw keys for each client — store them securely!
 * Optionally updates each client's .env on the server if updateEnv=true is passed.
 */
export const generateApiKeysForExistingClients = asyncHandler(async (req, res) => {
  const { updateEnv } = req.body; // if true, also update .env on server

  // Find all clients
  const allClients = await ClientModel.find().select('_id company_name subdomain db_name');

  // Find which clients already have active keys
  const existingKeys = await TenantApiKeyModel.find({ active: true }).select('client_id');
  const clientsWithKeys = new Set(existingKeys.map(k => k.client_id.toString()));

  // Filter to clients WITHOUT a key
  const clientsNeedingKeys = allClients.filter(c => !clientsWithKeys.has(c._id.toString()));

  if (clientsNeedingKeys.length === 0) {
    return SuccessResponse(res, {
      message: 'All clients already have active API keys. No action needed.',
      data: { generated: 0 }
    }, 200);
  }

  const results: Array<{
    clientId: string;
    companyName: string | undefined;
    subdomain: string | undefined;
    apiKey: string;
    envUpdated: boolean;
  }> = [];

  for (const client of clientsNeedingKeys) {
    // Generate unique key
    const rawApiKey = `sk_${crypto.randomUUID()}_${crypto.randomBytes(16).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(rawApiKey).digest('hex');

    await TenantApiKeyModel.create({
      client_id: client._id,
      hashedKey,
      label: 'migration',
      active: true,
    });

    let envUpdated = false;

    // Optionally update the .env on the server
    if (updateEnv && client.subdomain) {
      try {
        const path = require('path');
        const PLESK_VHOSTS_DIR = process.env.PLESK_VHOSTS_DIR || '/var/www/vhosts/systego.net/subdomains';
        const backendDestDir = path.join(PLESK_VHOSTS_DIR, `api-${client.subdomain}`);
        const frontendUrl = `${client.subdomain}.systego.net`;
        const dbName = client.db_name || `sc_${client._id}`;

        await generateBackendEnv(backendDestDir, client.subdomain, frontendUrl, {
          dbName,
          dbUser: process.env.MONGO_USER || 'admin',
          dbPass: encodeURIComponent(process.env.MONGO_PASS || 'MONGO@3030')
        }, rawApiKey);

        // Restart the Node.js app to pick up the new env
        const apiSubdomain = `api-${client.subdomain}.systego.net`;
        await executePleskCli('extension', ['--call', 'nodejs', '--disable', '-domain', apiSubdomain]);
        await executePleskCli('extension', ['--call', 'nodejs', '--enable', '-domain', apiSubdomain]);

        envUpdated = true;
      } catch (err: any) {
        console.error(`[Migration] Failed to update .env for ${client.company_name}: ${err.message}`);
      }
    }

    results.push({
      clientId: client._id.toString(),
      companyName: client.company_name,
      subdomain: client.subdomain,
      apiKey: rawApiKey,
      envUpdated,
    });

    console.log(`[Migration] Generated API key for ${client.company_name} (${client.subdomain})`);
  }

  return SuccessResponse(res, {
    message: `Generated API keys for ${results.length} existing clients. Store these keys securely — they will not be shown again!`,
    data: { generated: results.length, clients: results }
  }, 200);
});