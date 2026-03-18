"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiKeysForExistingClients = exports.regenerateApiKey = exports.viewSelection = exports.installClientSsl = exports.select = exports.regenerateClientEnv = exports.deployClientBackend = exports.rebuildClientFrontend = exports.getClientsByStatus = exports.deleteClient = exports.updateClient = exports.createClient = exports.getClientById = exports.getAllClients = void 0;
const Client_1 = require("../../models/schema/auth/Client");
const mongoose_1 = __importDefault(require("mongoose"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const NotFound_1 = require("../../Errors/NotFound");
const response_1 = require("../../utils/response");
const Package_1 = require("../../models/schema/auth/Package");
const Errors_1 = require("../../Errors");
const crypto_1 = __importDefault(require("crypto"));
const PleskService_1 = require("../../utils/PleskService");
const ClientProvisioner_1 = require("../../utils/ClientProvisioner");
const PleskService_2 = require("../../utils/PleskService");
const TenantApiKey_1 = require("../../models/schema/auth/TenantApiKey");
exports.getAllClients = (0, express_async_handler_1.default)(async (req, res) => {
    const clients = await Client_1.ClientModel.find()
        .select('-password -logoBase64 -admin_password') // Exclude heavy payloads & secrets
        .sort({ created_at: -1 })
        .populate({
        path: 'package_id',
        select: 'name price features' // Only get necessary package details
    });
    return (0, response_1.SuccessResponse)(res, { message: 'Clients retrieved successfully', data: clients }, 200);
});
exports.getClientById = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const client = await Client_1.ClientModel.findOne({ _id: id })
        .select('-password')
        .populate('package_id');
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
    }
    const clientResponse = client.toObject();
    return (0, response_1.SuccessResponse)(res, { message: 'Client retrieved successfully', data: clientResponse }, 200);
});
exports.createClient = (0, express_async_handler_1.default)(async (req, res) => {
    const { company_name, email, password, status, package_id, subdomain, logoBase64 } = req.body;
    // --- Validate package ---
    const existingPackage = await Package_1.PackageModel.findById(package_id);
    if (!existingPackage) {
        throw new NotFound_1.NotFound('Package not found');
    }
    // --- Validate email uniqueness ---
    const existingClient = await Client_1.ClientModel.findOne({ email });
    if (existingClient) {
        throw new Errors_1.UniqueConstrainError('Client with this email already exists');
    }
    // --- Validate & sanitize subdomain ---
    const validationError = (0, PleskService_1.validateSubdomainName)(subdomain);
    if (validationError) {
        throw new Errors_1.UniqueConstrainError(validationError);
    }
    const sanitizedSubdomain = (0, PleskService_1.sanitizeSubdomainName)(subdomain);
    // Check if subdomain is already taken
    const existingSubdomain = await Client_1.ClientModel.findOne({ subdomain: sanitizedSubdomain });
    if (existingSubdomain) {
        throw new Errors_1.UniqueConstrainError(`Subdomain "${sanitizedSubdomain}.systego.net" is already taken`);
    }
    // --- Create the client record ---
    const client = await Client_1.ClientModel.create({
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
        const newDbConnection = mongoose_1.default.connection.useDb(dbName, { useCache: true });
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
        }
        catch (e) {
            console.warn("Could not hash password for initial seed", e);
        }
        // 2. Match the Admin Schema keys perfectly
        await newDbConnection.collection(targetCollection).insertOne({
            username: 'admin', // Required by Admin Schema
            email: email, // Required by Admin Schema
            password_hash: initialPasswordHash, // Admin Schema uses password_hash
            company_name: company_name, // Optional in Admin Schema
            phone: "0000000000", // Ensure this matches any frontend requirements
            role: 'superadmin', // Admin Schema enum
            status: 'active', // Admin Schema enum
            permissions: [], // Default empty permissions array
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log(`Database ${dbName} created and seeded with compliant superadmin`);
    }
    catch (error) {
        console.error('Failed to create client database:', error);
        // Rollback: delete the client record
        await Client_1.ClientModel.findByIdAndDelete(client._id);
        throw new Error(`Failed to create client database: ${error.message || error}. Client creation rolled back.`);
    }
    // --- Provision the Client (Create Subdomains & Copy Files) ---
    let frontendUrl;
    let backendApiUrl;
    try {
        const provisionResult = await (0, ClientProvisioner_1.provisionNewClient)(sanitizedSubdomain, {
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
    }
    catch (error) {
        console.error('Failed to provision client in Plesk:', error.message);
        // Rollback: delete the client record and database
        await Client_1.ClientModel.findByIdAndDelete(client._id);
        try {
            await mongoose_1.default.connection.useDb(dbName, { useCache: true }).dropDatabase();
        }
        catch (dbError) {
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
    let rawApiKey;
    try {
        rawApiKey = `sk_${crypto_1.default.randomUUID()}_${crypto_1.default.randomBytes(16).toString('hex')}`;
        const hashedKey = crypto_1.default.createHash('sha256').update(rawApiKey).digest('hex');
        await TenantApiKey_1.TenantApiKeyModel.create({
            client_id: client._id,
            hashedKey,
            label: 'default',
            active: true,
        });
        console.log(`[Provisioning] Tenant API key generated for client: ${client.company_name}`);
    }
    catch (apiKeyError) {
        console.error('Failed to generate tenant API key:', apiKeyError.message);
        // Non-fatal: client is created, key can be regenerated later
    }
    // Strip sensitive info before returning
    const clientResponse = client.toObject();
    delete clientResponse.admin_password;
    delete clientResponse.password;
    return (0, response_1.SuccessResponse)(res, { message: 'Client created successfully', data: clientResponse }, 201);
});
exports.updateClient = (0, express_async_handler_1.default)(async (req, res) => {
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
    const client = await Client_1.ClientModel.findOneAndUpdate({ _id: id }, updateData, { new: true, runValidators: true }).select('-password').populate('package_id');
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
    }
    if (logoBase64 && client.subdomain) {
        const { updateClientLogo } = require('../../utils/ClientProvisioner');
        await updateClientLogo(client.subdomain, logoBase64);
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Client updated successfully', data: client }, 200);
});
exports.deleteClient = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const client = await Client_1.ClientModel.findById(id);
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
    }
    // --- Delete the Plesk subdomains ---
    if (client.subdomain) {
        try {
            await (0, PleskService_1.deleteSubdomain)(client.subdomain);
            console.log(`Frontend subdomain ${client.subdomain_url} deleted from Plesk`);
            // Also delete the backend subdomain
            const backendSubdomain = `api-${client.subdomain}`;
            await (0, PleskService_1.deleteSubdomain)(backendSubdomain);
            console.log(`Backend subdomain ${backendSubdomain}.systego.net deleted from Plesk`);
        }
        catch (error) {
            console.error('Failed to delete subdomains from Plesk:', error.message);
            // Continue with client deletion even if subdomain removal fails
            // The admin can manually clean it up in Plesk if needed
        }
    }
    // --- Drop the client's MongoDB database ---
    if (client.db_name) {
        try {
            await mongoose_1.default.connection.useDb(client.db_name, { useCache: true }).dropDatabase();
            console.log(`Database ${client.db_name} dropped`);
        }
        catch (error) {
            console.error('Failed to drop client database:', error);
        }
    }
    // --- Delete the client record ---
    await Client_1.ClientModel.findByIdAndDelete(id);
    return (0, response_1.SuccessResponse)(res, { message: 'Client deleted successfully' }, 200);
});
exports.getClientsByStatus = (0, express_async_handler_1.default)(async (req, res) => {
    const { status } = req.params;
    const clients = await Client_1.ClientModel.find({ status })
        .sort({ created_at: -1 })
        .populate('package_id');
    return (0, response_1.SuccessResponse)(res, { message: `Clients with status ${status} retrieved successfully`, data: clients }, 200);
});
exports.rebuildClientFrontend = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const client = await Client_1.ClientModel.findById(id);
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
    }
    if (!client.subdomain) {
        res.status(400).json({ success: false, message: 'Client has no subdomain' });
        return;
    }
    try {
        await (0, ClientProvisioner_1.rebuildFrontendForClient)(client.subdomain);
        return (0, response_1.SuccessResponse)(res, { message: 'Frontend rebuilt successfully' }, 200);
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to rebuild frontend', error: error.message });
    }
});
exports.deployClientBackend = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const client = await Client_1.ClientModel.findById(id);
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
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
        await (0, ClientProvisioner_1.deployBackendForClient)(client.subdomain, backendSubdomainUrl, backendDestDir);
        return (0, response_1.SuccessResponse)(res, { message: 'Backend Node.js application deployed and restarted successfully' }, 200);
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to deploy backend on Plesk', error: error.message });
    }
});
exports.regenerateClientEnv = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const client = await Client_1.ClientModel.findById(id);
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
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
        await (0, ClientProvisioner_1.generateBackendEnv)(backendDestDir, client.subdomain, frontendUrl, {
            dbName,
            dbUser: process.env.MONGO_USER || 'admin',
            dbPass: encodeURIComponent(process.env.MONGO_PASS || 'MONGO@3030')
        });
        // Restart the Node.js app to pick up new env
        const apiSubdomain = `api-${client.subdomain}.systego.net`;
        await (0, PleskService_2.executePleskCli)('extension', ['--call', 'nodejs', '--disable', '-domain', apiSubdomain]);
        await (0, PleskService_2.executePleskCli)('extension', ['--call', 'nodejs', '--enable', '-domain', apiSubdomain]);
        return (0, response_1.SuccessResponse)(res, { message: 'Backend .env regenerated and app restarted successfully' }, 200);
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to regenerate .env', error: error.message });
    }
});
exports.select = (0, express_async_handler_1.default)(async (req, res) => {
    const packages = await Package_1.PackageModel.find()
        .select('name')
        .sort({ created_at: -1 });
    return (0, response_1.SuccessResponse)(res, { message: 'Packages retrieved successfully', data: packages }, 200);
});
exports.installClientSsl = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const client = await Client_1.ClientModel.findById(id);
    if (!client || !client.subdomain) {
        throw new NotFound_1.NotFound('Client or subdomain not found');
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
        (0, response_1.SuccessResponse)(res, { message: 'SSL certificates successfully installed' }, 200);
    }
    catch (error) {
        console.error('[SSL API] Failed to install SSL:', error);
        res.status(500).json({
            success: false,
            message: `Failed to install SSL certificates: ${error.message}`
        });
    }
});
exports.viewSelection = (0, express_async_handler_1.default)(async (req, res) => {
    const packages = await Package_1.PackageModel.find();
    return (0, response_1.SuccessResponse)(res, { message: 'Packages retrieved successfully', data: packages }, 200);
});
/**
 * POST /api/admin/clients/:id/regenerate-api-key
 *
 * Revokes the old API key and generates a new one.
 * The new raw key is returned ONCE — it must be stored securely.
 */
exports.regenerateApiKey = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const client = await Client_1.ClientModel.findById(id);
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
    }
    // Revoke all existing active keys for this client
    await TenantApiKey_1.TenantApiKeyModel.updateMany({ client_id: client._id, active: true }, { $set: { active: false } });
    // Generate a new key
    const rawApiKey = `sk_${crypto_1.default.randomUUID()}_${crypto_1.default.randomBytes(16).toString('hex')}`;
    const hashedKey = crypto_1.default.createHash('sha256').update(rawApiKey).digest('hex');
    await TenantApiKey_1.TenantApiKeyModel.create({
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
            await (0, ClientProvisioner_1.generateBackendEnv)(backendDestDir, client.subdomain, frontendUrl, {
                dbName,
                dbUser: process.env.MONGO_USER || 'admin',
                dbPass: encodeURIComponent(process.env.MONGO_PASS || 'MONGO@3030')
            }, rawApiKey);
            // Restart the Node.js app to pick up the new env
            const apiSubdomain = `api-${client.subdomain}.systego.net`;
            await (0, PleskService_2.executePleskCli)('extension', ['--call', 'nodejs', '--disable', '-domain', apiSubdomain]);
            await (0, PleskService_2.executePleskCli)('extension', ['--call', 'nodejs', '--enable', '-domain', apiSubdomain]);
            console.log(`[API Key] Updated .env and restarted backend for ${client.company_name}`);
        }
        catch (envError) {
            console.error(`[API Key] Failed to update .env on server: ${envError.message}`);
            // Still return the key — admin can manually update the .env
        }
    }
    return (0, response_1.SuccessResponse)(res, {
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
exports.generateApiKeysForExistingClients = (0, express_async_handler_1.default)(async (req, res) => {
    const { updateEnv } = req.body; // if true, also update .env on server
    // Find all clients
    const allClients = await Client_1.ClientModel.find().select('_id company_name subdomain db_name');
    // Find which clients already have active keys
    const existingKeys = await TenantApiKey_1.TenantApiKeyModel.find({ active: true }).select('client_id');
    const clientsWithKeys = new Set(existingKeys.map(k => k.client_id.toString()));
    // Filter to clients WITHOUT a key
    const clientsNeedingKeys = allClients.filter(c => !clientsWithKeys.has(c._id.toString()));
    if (clientsNeedingKeys.length === 0) {
        return (0, response_1.SuccessResponse)(res, {
            message: 'All clients already have active API keys. No action needed.',
            data: { generated: 0 }
        }, 200);
    }
    const results = [];
    for (const client of clientsNeedingKeys) {
        // Generate unique key
        const rawApiKey = `sk_${crypto_1.default.randomUUID()}_${crypto_1.default.randomBytes(16).toString('hex')}`;
        const hashedKey = crypto_1.default.createHash('sha256').update(rawApiKey).digest('hex');
        await TenantApiKey_1.TenantApiKeyModel.create({
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
                await (0, ClientProvisioner_1.generateBackendEnv)(backendDestDir, client.subdomain, frontendUrl, {
                    dbName,
                    dbUser: process.env.MONGO_USER || 'admin',
                    dbPass: encodeURIComponent(process.env.MONGO_PASS || 'MONGO@3030')
                }, rawApiKey);
                // Restart the Node.js app to pick up the new env
                const apiSubdomain = `api-${client.subdomain}.systego.net`;
                await (0, PleskService_2.executePleskCli)('extension', ['--call', 'nodejs', '--disable', '-domain', apiSubdomain]);
                await (0, PleskService_2.executePleskCli)('extension', ['--call', 'nodejs', '--enable', '-domain', apiSubdomain]);
                envUpdated = true;
            }
            catch (err) {
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
    return (0, response_1.SuccessResponse)(res, {
        message: `Generated API keys for ${results.length} existing clients. Store these keys securely — they will not be shown again!`,
        data: { generated: results.length, clients: results }
    }, 200);
});
