import { ThemeModel } from '../../models/schema/auth/Theme';
import asyncHandler from 'express-async-handler';
import { NotFound } from '../../Errors/NotFound';
import { SuccessResponse } from '../../utils/response';
import { BadRequest } from '../../Errors/BadRequest';
import { saveBase64Image } from '../../utils/handleImages';
import { deletePhotoFromServer } from '../../utils/deleteImage';

export const getAllThemes = asyncHandler(async (req, res) => {
  const { categoryId } = req.query;
  const themes = await ThemeModel.find(categoryId ? { categoryId } : {})
    .sort({ created_at: -1 });

  return SuccessResponse(res, { message: 'Themes retrieved successfully', data: themes }, 200);
});

export const getThemeById = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const theme = await ThemeModel.findOne({ _id: id });

  if (!theme) {
    throw new NotFound('Theme not found');
  }

  return SuccessResponse(res, { message: 'Theme retrieved successfully', data: theme }, 200);
});

export const getThemeBySlug = asyncHandler(async (req, res) => {
  const slug = req.params.slug;
  const theme = await ThemeModel.findOne({ slug: slug.toLowerCase().replace(/ /g, '-') });

  if (!theme) {
    throw new NotFound('Theme not found');
  }

  return SuccessResponse(res, { message: 'Theme retrieved successfully', data: theme }, 200);
});

export const createTheme = asyncHandler(async (req, res) => {
  const { name, thumbnailUrl, slug, categoryId, sections, defaultConfig, isBase } = req.body;
  const existingTheme = await ThemeModel.findOne({ slug: slug.toLowerCase().replace(/ /g, '-') });
  if (existingTheme) {
    throw new BadRequest('Theme with this slug already exists');
  }
  const imageUrl = saveBase64Image(thumbnailUrl, req.user?.id!, req, 'themes'); // Save the image and get the URL
  const newTheme = await ThemeModel.create({
    name,
    slug: slug.toLowerCase().replace(/ /g, '-'),
    categoryId,
    sections,
    defaultConfig,
    isBase,
    thumbnailUrl: imageUrl
  });

  return SuccessResponse(res, { message: 'Theme created successfully', data: newTheme }, 201);
});

export const updateTheme = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const updateData = req.body;

  const theme = await ThemeModel.findOneAndUpdate(
    { _id: id },
    updateData,
    { new: true, runValidators: true }
  );

  if (!theme) {
    throw new NotFound('Theme not found');
  }
  if(updateData.thumbnailUrl) {
    const imageUrl = await saveBase64Image(updateData.thumbnailUrl, req.user?.id!, req, 'themes');
    theme.thumbnailUrl = imageUrl;
    await theme.save();
    deletePhotoFromServer(theme.thumbnailUrl); 
  }

  return SuccessResponse(res, { message: 'Theme updated successfully', data: theme }, 200);
});

export const deleteTheme = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const theme = await ThemeModel.findOneAndDelete({ _id: id });

  if (!theme) {
    throw new NotFound('Theme not found');
  }
  if(theme.thumbnailUrl) {
    deletePhotoFromServer(theme.thumbnailUrl);
  }
  return SuccessResponse(res, { message: 'Theme deleted successfully', data: theme }, 200);
});

export const bulkCreateThemes = asyncHandler(async (req, res) => {
  const themesData = req.body; 
    if (!Array.isArray(themesData) || themesData.length === 0) {
    throw new BadRequest('themesData must be a non-empty array');
  }

  const slugs = themesData.map(t => t.slug);
  const hasDuplicateSlugs = new Set(slugs).size !== slugs.length;
  if (hasDuplicateSlugs) throw new BadRequest('Duplicate slugs within the request payload');

  const existing = await ThemeModel.find({ slug: { $in: slugs } }).select('slug');
  if (existing.length > 0) {
    const existingSlugs = existing.map(t => t.slug);
    throw new BadRequest(`Themes already exist for slugs: ${existingSlugs.join(', ')}`);
  }

  const inserted = await ThemeModel.insertMany(themesData, { ordered: true });
  SuccessResponse(res, { message: 'Themes created successfully', data: inserted }, 201);
})