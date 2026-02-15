"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponModel = void 0;
const mongoose_1 = require("mongoose");
const mongoose_2 = __importDefault(require("mongoose"));
const CouponSchema = new mongoose_1.Schema({
    code: { type: String, unique: true },
    discount_type: { type: String, enum: ["value", "percentage"] },
    discount: { type: Number, },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    status: { type: Boolean, required: true },
}, { timestamps: true, });
exports.CouponModel = mongoose_2.default.model('Coupon', CouponSchema);
