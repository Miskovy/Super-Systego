"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const ThemeSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    categoryId: { type: mongoose_1.default.Schema.Types.ObjectId, required: true, ref: "ThemeCategory" },
    thumbnailUrl: { type: String },
    isBase: { type: Boolean, default: false },
    sections: [{ type: String, required: true }],
    defaultConfig: {
        colorKeys: [{ type: String }],
        fontOptions: [{ type: String }],
        colors: { type: Map, of: String },
    },
}, { timestamps: true });
exports.ThemeModel = mongoose_1.default.model("Theme", ThemeSchema);
