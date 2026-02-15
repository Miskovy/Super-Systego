"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentModel = void 0;
const mongoose_1 = require("mongoose");
const mongoose_2 = __importDefault(require("mongoose"));
const PaymentSchema = new mongoose_1.Schema({
    client_id: {
        type: mongoose_2.default.Schema.Types.ObjectId,
        ref: 'Client'
    },
    package_id: {
        type: mongoose_2.default.Schema.Types.ObjectId,
        ref: 'Package'
    },
    coupon_id: {
        type: mongoose_2.default.Schema.Types.ObjectId,
        ref: 'Coupon'
    },
    amount: { type: Number, required: true },
    date: { type: Date, },
    status: { type: String, enum: ['pending', 'approve', 'reject'] },
}, { timestamps: true, });
exports.PaymentModel = mongoose_2.default.model('Payment', PaymentSchema);
