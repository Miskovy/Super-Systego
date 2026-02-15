"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePaymentMethodValidator = exports.createPaymentMethodValidator = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createPaymentMethodValidator = joi_1.default.object({
    name: joi_1.default.string().trim().min(2).max(50).required()
        .messages({
        'string.empty': 'Payment method name is required',
        'string.min': 'Payment method name must be at least 2 characters long',
        'string.max': 'Payment method name cannot exceed 50 characters',
        'any.required': 'Payment method name is required'
    }),
    description: joi_1.default.string().trim().max(500).optional().allow('')
        .messages({
        'string.max': 'Description cannot exceed 500 characters'
    }),
    logo: joi_1.default.string().trim().uri().required()
        .messages({
        'string.uri': 'Logo must be a valid URL',
        'string.empty': 'Logo URL is required',
        'any.required': 'Logo URL is required'
    }),
    status: joi_1.default.boolean().required()
        .messages({
        'boolean.base': 'Status must be a boolean value (true/false)',
        'any.required': 'Status is required'
    })
});
exports.updatePaymentMethodValidator = joi_1.default.object({
    name: joi_1.default.string().trim().min(2).max(50).optional()
        .messages({
        'string.min': 'Payment method name must be at least 2 characters long',
        'string.max': 'Payment method name cannot exceed 50 characters'
    }),
    description: joi_1.default.string().trim().max(500).optional().allow('')
        .messages({
        'string.max': 'Description cannot exceed 500 characters'
    }),
    logo: joi_1.default.string().trim().uri().optional()
        .messages({
        'string.uri': 'Logo must be a valid URL'
    }),
    status: joi_1.default.boolean().optional()
        .messages({
        'boolean.base': 'Status must be a boolean value (true/false)'
    })
}).min(1).messages({
    'object.min': 'At least one field is required to update'
});
