import { ThemeModel } from '../../models/shema/auth/Theme';
import asyncHandler from 'express-async-handler';
import { NotFound } from '../../Errors/NotFound';
import { SuccessResponse } from '../../utils/response';

export const getAllThemes = asyncHandler(async (req, res) => {
  const themes = await ThemeModel.find()
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

export const createTheme = asyncHandler(async (req, res) => {
  const { name, description, theme } = req.body;
  
  const newTheme = await ThemeModel.create({
    name,
    description,
    theme
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

  return SuccessResponse(res, { message: 'Theme updated successfully', data: theme }, 200);
});

export const deleteTheme = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const theme = await ThemeModel.findOneAndDelete({ _id: id });

  if (!theme) {
    throw new NotFound('Theme not found');
  }

  return SuccessResponse(res, { message: 'Theme deleted successfully', data: theme }, 200);
});