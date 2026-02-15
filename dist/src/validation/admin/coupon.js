"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.couponSchema = joi_1.default.object({
    code: joi_1.default.string().required(),
    discount_type: joi_1.default.string().valid("value", "percentage").required(),
    discount: joi_1.default.number().required(),
    from: joi_1.default.date().required(),
    to: joi_1.default.date().required(),
    status: joi_1.default.boolean().required(),
});
