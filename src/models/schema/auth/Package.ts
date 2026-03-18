import mongoose from "mongoose";

const PackageSchema = new mongoose.Schema(
  {
    name: { type: String, },
    description: { type: String, },
    monthly_price: { type: Number, required: true },
    quarterly_price: { type: Number, required: true },
    half_yearly_price: { type: Number, required: true },
    yearly_price: { type: Number, required: true },
    status: { type: Boolean },
    haveEcommerce: { type: Boolean, default: false },
    haveMobileApp: { type: Boolean, default: false }
  },
  { timestamps: true, }
);

export const PackageModel = mongoose.model('Package', PackageSchema);

