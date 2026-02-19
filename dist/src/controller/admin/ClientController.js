"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.select = exports.getClientsByStatus = exports.deleteClient = exports.updateClient = exports.createClient = exports.getClientById = exports.getAllClients = void 0;
const Client_1 = require("../../models/shema/auth/Client");
const mongoose_1 = __importDefault(require("mongoose"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const NotFound_1 = require("../../Errors/NotFound");
const response_1 = require("../../utils/response");
const Package_1 = require("../../models/shema/auth/Package");
const Errors_1 = require("../../Errors");
const PleskService_1 = require("../../utils/PleskService");
exports.getAllClients = (0, express_async_handler_1.default)(async (req, res) => {
    const clients = await Client_1.ClientModel.find()
        .select('-password')
        .sort({ created_at: -1 })
        .populate('package_id');
    return (0, response_1.SuccessResponse)(res, { message: 'Clients retrieved successfully', data: clients }, 200);
});
exports.getClientById = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const client = await Client_1.ClientModel.findOne({ _id: id })
        .populate('package_id');
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Client retrieved successfully', data: client }, 200);
});
exports.createClient = (0, express_async_handler_1.default)(async (req, res) => {
    const { company_name, email, password, status, package_id, subdomain } = req.body;
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
    });
    const dbName = `systego_client_${client._id}`;
    // --- Create the client's MongoDB database ---
    try {
        const newDbConnection = mongoose_1.default.connection.useDb(dbName, { useCache: true });
        await newDbConnection.createCollection('metadata');
        await newDbConnection.collection('metadata').insertOne({
            created_at: new Date(),
            client_id: client._id,
            company_name: client.company_name,
        });
        console.log(`Database ${dbName} created via useDb`);
    }
    catch (error) {
        console.error('Failed to create client database:', error);
        // Rollback: delete the client record
        await Client_1.ClientModel.findByIdAndDelete(client._id);
        throw new Error('Failed to create client database. Client creation rolled back.');
    }
    // --- Create the Plesk subdomain ---
    let subdomainUrl;
    try {
        subdomainUrl = await (0, PleskService_1.createSubdomain)(sanitizedSubdomain);
        console.log(`Subdomain ${subdomainUrl} created in Plesk`);
    }
    catch (error) {
        console.error('Failed to create subdomain in Plesk:', error.message);
        // Rollback: delete the client record and database
        await Client_1.ClientModel.findByIdAndDelete(client._id);
        try {
            await mongoose_1.default.connection.useDb(dbName, { useCache: true }).dropDatabase();
        }
        catch (dbError) {
            console.error('Failed to rollback database:', dbError);
        }
        throw new Error(`Failed to create subdomain in Plesk: ${error.message}`);
    }
    // --- Update client with db_name and subdomain_url ---
    client.db_name = dbName;
    client.subdomain_url = subdomainUrl;
    await client.save();
    return (0, response_1.SuccessResponse)(res, { message: 'Client created successfully', data: client }, 201);
});
exports.updateClient = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const updateData = req.body;
    // Prevent subdomain changes (subdomain is immutable after creation)
    if (updateData.subdomain || updateData.subdomain_url) {
        delete updateData.subdomain;
        delete updateData.subdomain_url;
    }
    const client = await Client_1.ClientModel.findOneAndUpdate({ _id: id }, updateData, { new: true, runValidators: true }).populate('package_id');
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Client updated successfully', data: client }, 200);
});
exports.deleteClient = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const client = await Client_1.ClientModel.findById(id);
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
    }
    // --- Delete the Plesk subdomain ---
    if (client.subdomain) {
        try {
            await (0, PleskService_1.deleteSubdomain)(client.subdomain);
            console.log(`Subdomain ${client.subdomain_url} deleted from Plesk`);
        }
        catch (error) {
            console.error('Failed to delete subdomain from Plesk:', error.message);
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
    return (0, response_1.SuccessResponse)(res, { message: 'Client deleted successfully', data: client }, 200);
});
exports.getClientsByStatus = (0, express_async_handler_1.default)(async (req, res) => {
    const { status } = req.params;
    const clients = await Client_1.ClientModel.find({ status })
        .sort({ created_at: -1 })
        .populate('package_id');
    return (0, response_1.SuccessResponse)(res, { message: `Clients with status ${status} retrieved successfully`, data: clients }, 200);
});
exports.select = (0, express_async_handler_1.default)(async (req, res) => {
    const packages = await Package_1.PackageModel.find()
        .select('name')
        .sort({ created_at: -1 });
    return (0, response_1.SuccessResponse)(res, { message: 'Packages retrieved successfully', data: packages }, 200);
});
