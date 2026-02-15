"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTheme = exports.updateTheme = exports.createTheme = exports.getThemeById = exports.getAllThemes = void 0;
const Theme_1 = require("../../models/shema/auth/Theme");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const NotFound_1 = require("../../Errors/NotFound");
const response_1 = require("../../utils/response");
exports.getAllThemes = (0, express_async_handler_1.default)(async (req, res) => {
    const themes = await Theme_1.ThemeModel.find()
        .sort({ created_at: -1 });
    return (0, response_1.SuccessResponse)(res, { message: 'Themes retrieved successfully', data: themes }, 200);
});
exports.getThemeById = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const theme = await Theme_1.ThemeModel.findOne({ _id: id });
    if (!theme) {
        throw new NotFound_1.NotFound('Theme not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Theme retrieved successfully', data: theme }, 200);
});
exports.createTheme = (0, express_async_handler_1.default)(async (req, res) => {
    const { name, description, theme } = req.body;
    const newTheme = await Theme_1.ThemeModel.create({
        name,
        description,
        theme
    });
    return (0, response_1.SuccessResponse)(res, { message: 'Theme created successfully', data: newTheme }, 201);
});
exports.updateTheme = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const updateData = req.body;
    const theme = await Theme_1.ThemeModel.findOneAndUpdate({ _id: id }, updateData, { new: true, runValidators: true });
    if (!theme) {
        throw new NotFound_1.NotFound('Theme not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Theme updated successfully', data: theme }, 200);
});
exports.deleteTheme = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const theme = await Theme_1.ThemeModel.findOneAndDelete({ _id: id });
    if (!theme) {
        throw new NotFound_1.NotFound('Theme not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Theme deleted successfully', data: theme }, 200);
});
