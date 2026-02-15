import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
 const PaymentMethodSchema = new Schema(
  { 
    name: {
        type: String, required: true
    },
    description: {
        type: String
    },
    logo: {
        type: String, required: true
    },
    status: { type: Boolean,  required: true },
  },
  { timestamps: true, }
);

export const PaymentMethodModel = mongoose.model('PaymentMethod', PaymentMethodSchema);

