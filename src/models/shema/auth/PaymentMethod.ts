import mongoose from "mongoose";

const PaymentMethodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    logo: { type: String, required: true },
    status: { type: Boolean, required: true },
  },
  { timestamps: true, }
);

export const PaymentMethodModel = mongoose.model('PaymentMethod', PaymentMethodSchema);

