"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethodModel = void 0;
const mongoose_1 = require("mongoose");
const mongoose_2 = __importDefault(require("mongoose"));
const PaymentMethodSchema = new mongoose_1.Schema({
    name: {
        type: String, required: true
    },
    description: {
        type: String
    },
    logo: {
        type: String, required: true
    },
    status: { type: Boolean, required: true },
}, { timestamps: true, });
exports.PaymentMethodModel = mongoose_2.default.model('PaymentMethod', PaymentMethodSchema);
