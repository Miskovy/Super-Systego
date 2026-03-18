"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const PackageSchema = new mongoose_1.default.Schema({
    name: { type: String, },
    description: { type: String, },
    monthly_price: { type: Number, required: true },
    quarterly_price: { type: Number, required: true },
    half_yearly_price: { type: Number, required: true },
    yearly_price: { type: Number, required: true },
    status: { type: Boolean },
    haveEcommerce: { type: Boolean, default: false },
    haveMobileApp: { type: Boolean, default: false }
}, { timestamps: true, });
exports.PackageModel = mongoose_1.default.model('Package', PackageSchema);
