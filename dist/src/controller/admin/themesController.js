"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkCreateThemes = exports.deleteTheme = exports.updateTheme = exports.createTheme = exports.getThemeBySlug = exports.getThemeById = exports.getAllThemes = void 0;
const Theme_1 = require("../../models/schema/auth/Theme");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const NotFound_1 = require("../../Errors/NotFound");
const response_1 = require("../../utils/response");
const BadRequest_1 = require("../../Errors/BadRequest");
const handleImages_1 = require("../../utils/handleImages");
const deleteImage_1 = require("../../utils/deleteImage");
exports.getAllThemes = (0, express_async_handler_1.default)(async (req, res) => {
    const { categoryId } = req.query;
    const themes = await Theme_1.ThemeModel.find(categoryId ? { categoryId } : {})
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
exports.getThemeBySlug = (0, express_async_handler_1.default)(async (req, res) => {
    const slug = req.params.slug;
    const theme = await Theme_1.ThemeModel.findOne({ slug: slug.toLowerCase().replace(/ /g, '-') });
    if (!theme) {
        throw new NotFound_1.NotFound('Theme not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Theme retrieved successfully', data: theme }, 200);
});
exports.createTheme = (0, express_async_handler_1.default)(async (req, res) => {
    const { name, image, categoryId, sections, defaultConfig, isBase } = req.body;
    const existingTheme = await Theme_1.ThemeModel.findOne({ slug: name.toLowerCase().replace(/ /g, '-') });
    if (existingTheme) {
        throw new BadRequest_1.BadRequest('Theme with this slug already exists');
    }
    const thumbnailUrl = (0, handleImages_1.saveBase64Image)(image, req.user?.id, req, 'themes'); // Save the image and get the URL
    const newTheme = await Theme_1.ThemeModel.create({
        name,
        slug: name.toLowerCase().replace(/ /g, '-'),
        categoryId,
        sections,
        defaultConfig,
        isBase,
        thumbnailUrl
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
    if (updateData.thumbnailUrl) {
        const imageUrl = await (0, handleImages_1.saveBase64Image)(updateData.thumbnailUrl, req.user?.id, req, 'themes');
        theme.thumbnailUrl = imageUrl;
        await theme.save();
        (0, deleteImage_1.deletePhotoFromServer)(theme.thumbnailUrl);
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Theme updated successfully', data: theme }, 200);
});
exports.deleteTheme = (0, express_async_handler_1.default)(async (req, res) => {
    const id = req.params.id;
    const theme = await Theme_1.ThemeModel.findOneAndDelete({ _id: id });
    if (!theme) {
        throw new NotFound_1.NotFound('Theme not found');
    }
    if (theme.thumbnailUrl) {
        (0, deleteImage_1.deletePhotoFromServer)(theme.thumbnailUrl);
    }
    return (0, response_1.SuccessResponse)(res, { message: 'Theme deleted successfully', data: theme }, 200);
});
exports.bulkCreateThemes = (0, express_async_handler_1.default)(async (req, res) => {
    const themesData = req.body;
    if (!Array.isArray(themesData) || themesData.length === 0) {
        throw new BadRequest_1.BadRequest('themesData must be a non-empty array');
    }
    const slugs = themesData.map(t => t.slug);
    const hasDuplicateSlugs = new Set(slugs).size !== slugs.length;
    if (hasDuplicateSlugs)
        throw new BadRequest_1.BadRequest('Duplicate slugs within the request payload');
    const existing = await Theme_1.ThemeModel.find({ slug: { $in: slugs } }).select('slug');
    if (existing.length > 0) {
        const existingSlugs = existing.map(t => t.slug);
        throw new BadRequest_1.BadRequest(`Themes already exist for slugs: ${existingSlugs.join(', ')}`);
    }
    const inserted = await Theme_1.ThemeModel.insertMany(themesData, { ordered: true });
    (0, response_1.SuccessResponse)(res, { message: 'Themes created successfully', data: inserted }, 201);
});
