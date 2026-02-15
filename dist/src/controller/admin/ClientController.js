"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientsByStatus = exports.deleteClient = exports.updateClient = exports.createClient = exports.getClientById = exports.getAllClients = void 0;
const Client_1 = require("../../models/shema/auth/Client");
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
    const client = await Client_1.ClientModel.create({
        company_name,
        email,
        password,
        status,
        package_id
    });
    return (0, response_1.SuccessResponse)(res, { message: 'Client created successfully' }, 201);
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
