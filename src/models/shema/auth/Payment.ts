import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
 const PaymentSchema = new Schema(
  { 
    client_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client' 
    },
    package_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package' 
    },
    coupon_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon' 
    },
    amount: { type: Number, required: true },
    date: { type: Date, },
    status: { type: String, enum: ['pending', 'approve', 'reject']},
  },
  { timestamps: true, }
);

export const PaymentModel = mongoose.model('Payment', PaymentSchema);

