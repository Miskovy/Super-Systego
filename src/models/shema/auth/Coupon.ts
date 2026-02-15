import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
 const CouponSchema = new Schema(
  {
    
    code: { type: String, unique: true},
    discount_type: { type: String, enum: ["value", "percentage"] },
    discount: { type: Number, },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    status: { type: Boolean, required: true },
  },
  { timestamps: true, }
);

export const CouponModel = mongoose.model('Coupon', CouponSchema);

