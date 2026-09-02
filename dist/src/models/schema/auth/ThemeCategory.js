"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeCategoryModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const ThemeCategorySchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    description: { type: String },
    ar_name: { type: String, required: true },
}, { timestamps: true });
exports.ThemeCategoryModel = mongoose_1.default.model("ThemeCategory", ThemeCategorySchema);
