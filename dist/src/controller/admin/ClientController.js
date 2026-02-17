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
    const { company_name, email, password, status, package_id } = req.body;
    // check package_id exists
    const existingPackage = await Package_1.PackageModel.findById(package_id);
    if (!existingPackage) {
        throw new NotFound_1.NotFound('Package not found');
    }
    //check if client email already exists
    const existingClient = await Client_1.ClientModel.findOne({ email });
    if (existingClient) {
        throw new Errors_1.UniqueConstrainError('Client with this email already exists');
    }
    /* Create the new client first to get the ID (or use a generated ID)
       Actually, let's create the client with the db_name first.
    */
    // Generate a unique database name
    // We can use the company name or just a random ID. Let's use a combination or just a prefix + timestamp to ensure uniqueness if we don't have the client ID yet.
    // Better approach: Create the client instance but don't save it yet, or save it and then update it?
    // Let's create the client first.
    const client = await Client_1.ClientModel.create({
        company_name,
        email,
        password,
        status,
        package_id
    });
    const dbName = `systego_client_${client._id}`;
    // Update client with db_name
    client.db_name = dbName;
    await client.save();
    // Create the new database
    try {
        const mongoUri = process.env.MongoDB_URI || "";
        // Append the new database name to the URI connection string? 
        // Usually the URI is like mongodb://host:port/admin or similar.
        // If we connect to a new DB name, Mongo creates it.
        // We need to parse the URI and replace the DB name, or just pass the dbName option if using createConnection
        // Assuming URI is strict, let's try to just connect with the same URI but switching logical DB is different. 
        // mongoose.createConnection(uri, options)
        // Simplest way: Construct a new URI with the new DB name
        // But connection string might have auth source.
        // Let's assumes a standard URI format for now or use the existing connection info.
        // Actually, createConnection returns a connection instance.
        // If we want to create a DB, we just need to write something to it.
        // Let's use the same base URI but change the database name if possible.
        // If the URI includes the database name, we should replace it.
        // If it doesn't, we append it.
        // A safer way is to use the `useDb` method on the existing connection if we want to switch context, 
        // but `useDb` returns a connection to that DB.
        // Let's try:
        const newDbConnection = mongoose_1.default.connection.useDb(dbName, { useCache: true });
        // We need to create a collection to persist the DB
        await newDbConnection.createCollection('metadata');
        // Insert a document to be sure
        await newDbConnection.collection('metadata').insertOne({
            created_at: new Date(),
            client_id: client._id,
            company_name: client.company_name
        });
        console.log(`Database ${dbName} created via useDb`);
    }
    catch (error) {
        console.error("Failed to create client database:", error);
        // Should we delete the client if DB creation fails? 
        // For now, let's just log it.
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Client created successfully', data: client }, 201);
});
exports.updateClient = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const updateData = req.body;
    const client = await Client_1.ClientModel.findOneAndUpdate({ _id: id }, updateData, { new: true, runValidators: true }).populate('package_id');
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Client updated successfully', data: client }, 200);
});
exports.deleteClient = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const client = await Client_1.ClientModel.findOneAndDelete({ _id: id });
    if (!client) {
        throw new NotFound_1.NotFound('Client not found');
    }
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
