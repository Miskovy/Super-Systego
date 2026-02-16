import mongoose from "mongoose";

const ThemeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    theme: { type: String, required: true },
  },
  { timestamps: true, }
);

export const ThemeModel = mongoose.model('Theme', ThemeSchema);

