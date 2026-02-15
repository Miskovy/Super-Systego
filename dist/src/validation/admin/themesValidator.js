"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateThemeValidator = exports.createThemeValidator = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createThemeValidator = joi_1.default.object({
    name: joi_1.default.string().trim().min(2).max(100).required()
        .messages({
        'string.empty': 'Theme name is required',
        'string.min': 'Theme name must be at least 2 characters long',
        'string.max': 'Theme name cannot exceed 100 characters',
        'any.required': 'Theme name is required'
    }),
    description: joi_1.default.string().trim().max(500).optional().allow('')
        .messages({
        'string.max': 'Description cannot exceed 500 characters'
    }),
    theme: joi_1.default.string().trim().required()
        .messages({
        'string.empty': 'Theme value is required',
        'any.required': 'Theme value is required'
    })
});
exports.updateThemeValidator = joi_1.default.object({
    name: joi_1.default.string().trim().min(2).max(100).optional()
        .messages({
        'string.min': 'Theme name must be at least 2 characters long',
        'string.max': 'Theme name cannot exceed 100 characters'
    }),
    description: joi_1.default.string().trim().max(500).optional().allow('')
        .messages({
        'string.max': 'Description cannot exceed 500 characters'
    }),
    theme: joi_1.default.string().trim().optional()
        .messages({
        'string.empty': 'Theme value cannot be empty'
    })
}).min(1).messages({
    'object.min': 'At least one field is required to update'
});
