"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.couponSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    description: joi_1.default.string().required(),
    monthly_price: joi_1.default.number().required(),
    quarterly_price: joi_1.default.number().required(),
    half_yearly_price: joi_1.default.number().required(),
    yearly_price: joi_1.default.number().required(),
    status: joi_1.default.boolean().required(),
});
