"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivePaymentMethods = exports.deletePaymentMethod = exports.updatePaymentMethod = exports.createPaymentMethod = exports.getPaymentMethodById = exports.getAllPaymentMethods = void 0;
const PaymentMethod_1 = require("../../models/shema/auth/PaymentMethod");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const NotFound_1 = require("../../Errors/NotFound");
const unauthorizedError_1 = require("../../Errors/unauthorizedError");
const response_1 = require("../../utils/response");
const handleImages_1 = require("../../utils/handleImages");
exports.getAllPaymentMethods = (0, express_async_handler_1.default)(async (req, res) => {
    const paymentMethods = await PaymentMethod_1.PaymentMethodModel.find()
        .sort({ created_at: -1 });
    return (0, response_1.SuccessResponse)(res, { message: 'Payment methods retrieved successfully', data: paymentMethods }, 200);
});
exports.getPaymentMethodById = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const paymentMethod = await PaymentMethod_1.PaymentMethodModel.findOne({ _id: id });
    if (!paymentMethod) {
        throw new NotFound_1.NotFound('Payment method not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Payment method retrieved successfully', data: paymentMethod }, 200);
});
exports.createPaymentMethod = (0, express_async_handler_1.default)(async (req, res) => {
    const { name, description, status } = req.body;
    const userId = req.user?.id;
    if (!userId) {
        throw new unauthorizedError_1.UnauthorizedError('User authentication failed');
    }
    const base64 = req.body.logo;
    const folder = 'payment-methods';
    const imageUrl = await (0, handleImages_1.saveBase64Image)(base64, userId, req, folder);
    const paymentMethod = await PaymentMethod_1.PaymentMethodModel.create({
        name,
        description,
        logo: imageUrl,
        status
    });
    return (0, response_1.SuccessResponse)(res, { message: 'Payment method created successfully', data: paymentMethod }, 201);
});
exports.updatePaymentMethod = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const updateData = req.body;
    const paymentMethod = await PaymentMethod_1.PaymentMethodModel.findOneAndUpdate({ _id: id }, updateData, { new: true, runValidators: true });
    if (!paymentMethod) {
        throw new NotFound_1.NotFound('Payment method not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Payment method updated successfully', data: paymentMethod }, 200);
});
exports.deletePaymentMethod = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const paymentMethod = await PaymentMethod_1.PaymentMethodModel.findOneAndDelete({ _id: id });
    if (!paymentMethod) {
        throw new NotFound_1.NotFound('Payment method not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Payment method deleted successfully', data: paymentMethod }, 200);
});
exports.getActivePaymentMethods = (0, express_async_handler_1.default)(async (req, res) => {
    const paymentMethods = await PaymentMethod_1.PaymentMethodModel.find({ status: true })
        .sort({ created_at: -1 });
    return (0, response_1.SuccessResponse)(res, { message: 'Active payment methods retrieved successfully', data: paymentMethods }, 200);
});
