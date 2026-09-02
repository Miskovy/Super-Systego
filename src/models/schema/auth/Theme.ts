import mongoose from "mongoose";

const ThemeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "ThemeCategory" },
    thumbnailUrl: { type: String },
    isBase: { type: Boolean, default: false },
    sections: [{ type: String, required: true }],
    defaultConfig: {
      colorKeys: [{ type: String }], 
      fontOptions: [{ type: String }], 
      colors: { type: Map, of: String }, 
    },
  },
  { timestamps: true }
);

export const ThemeModel = mongoose.model("Theme", ThemeSchema);
