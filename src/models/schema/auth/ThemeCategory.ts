import mongoose from "mongoose";

const ThemeCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    ar_name: { type: String, required: true },
  },
  { timestamps: true }
);

export const ThemeCategoryModel = mongoose.model("ThemeCategory", ThemeCategorySchema);
