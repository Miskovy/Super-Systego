"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteThemeCategory = exports.updateThemeCategory = exports.getThemeCategoryById = exports.getAllThemeCategories = exports.createThemeCategory = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const NotFound_1 = require("../../Errors/NotFound");
const BadRequest_1 = require("../../Errors/BadRequest");
const ThemeCategory_1 = require("../../models/schema/auth/ThemeCategory");
const response_1 = require("../../utils/response");
const Theme_1 = require("../../models/schema/auth/Theme");
exports.createThemeCategory = (0, express_async_handler_1.default)(async (req, res) => {
    const { name, description, ar_name } = req.body;
    const exists = await ThemeCategory_1.ThemeCategoryModel.findOne({ name });
    if (exists)
        throw new BadRequest_1.BadRequest("Category with this name already exists");
    const category = await ThemeCategory_1.ThemeCategoryModel.create({ name, slug: name.toLowerCase().replace(/ /g, '-'), ar_name, description });
    (0, response_1.SuccessResponse)(res, { message: "Category created", category });
});
exports.getAllThemeCategories = (0, express_async_handler_1.default)(async (req, res) => {
    const categories = await ThemeCategory_1.ThemeCategoryModel.find();
    (0, response_1.SuccessResponse)(res, { message: "Categories retrieved", categories });
});
exports.getThemeCategoryById = (0, express_async_handler_1.default)(async (req, res) => {
    const { id } = req.params;
    const category = await ThemeCategory_1.ThemeCategoryModel.findById(id);
    if (!category)
        throw new NotFound_1.NotFound("Category not found");
    const themes = await Theme_1.ThemeModel.find({ category: id });
    (0, response_1.SuccessResponse)(res, { message: "Category retrieved", ...category.toObject(), themes });
});
exports.updateThemeCategory = (0, express_async_handler_1.default)(async (req, res) => {
    const { id } = req.params;
    const { name, description, ar_name } = req.body;
    const category = await ThemeCategory_1.ThemeCategoryModel.findByIdAndUpdate(id, { name, slug: name.toLowerCase().replace(/ /g, '-'), ar_name, description }, { new: true });
    if (!category)
        throw new NotFound_1.NotFound("Category not found");
    (0, response_1.SuccessResponse)(res, { message: "Category updated", category });
});
exports.deleteThemeCategory = (0, express_async_handler_1.default)(async (req, res) => {
    const { id } = req.params;
    const category = await ThemeCategory_1.ThemeCategoryModel.findByIdAndDelete(id);
    if (!category)
        throw new NotFound_1.NotFound("Category not found");
    (0, response_1.SuccessResponse)(res, { message: "Category deleted", category });
});
