import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { NotFound } from "../../Errors/NotFound";
import { BadRequest } from "../../Errors/BadRequest";
import { ThemeCategoryModel } from "../../models/schema/auth/ThemeCategory";
import { SuccessResponse } from "../../utils/response";
import { ThemeModel } from "../../models/schema/auth/Theme";

export const createThemeCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, ar_name } = req.body;

  const exists = await ThemeCategoryModel.findOne({ name });
  if (exists)
    throw new BadRequest("Category with this name already exists");

  const category = await ThemeCategoryModel.create({ name, slug: name.toLowerCase().replace(/ /g, '-'), ar_name, description });
  SuccessResponse(res, {message:"Category created", category});
});

export const getAllThemeCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await ThemeCategoryModel.find();
  SuccessResponse(res, {message:"Categories retrieved", categories});
});

export const getThemeCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const category = await ThemeCategoryModel.findById(id);
  if (!category)
    throw new NotFound("Category not found");

  const themes = await ThemeModel.find({ category: id });

  SuccessResponse(res, { message: "Category retrieved", ...category.toObject(), themes });
});

export const updateThemeCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, ar_name } = req.body;
  const category = await ThemeCategoryModel.findByIdAndUpdate(id, { name, slug: name.toLowerCase().replace(/ /g, '-'), ar_name, description }, { new: true });
  if (!category)
    throw new NotFound("Category not found");
  SuccessResponse(res, { message: "Category updated", category });
});

export const deleteThemeCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const category = await ThemeCategoryModel.findByIdAndDelete(id);
  if (!category)
    throw new NotFound("Category not found");
  SuccessResponse(res, { message: "Category deleted", category });
});