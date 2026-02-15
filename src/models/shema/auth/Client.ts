import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import bcrypt from 'bcrypt';


interface IClient {
  company_name?: string;
  email?: string;
  password?: string;
  status?: string;
  package_id?: Types.ObjectId;
}

const ClientSchema = new Schema<IClient>(
  {
    company_name: { type: String, },
    email: { type: String, unique: true },
    password: { type: String },
    status: { type: String },
    package_id: { type: Types.ObjectId, ref: 'Package' },
  },
  { timestamps: true, }
);

ClientSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  try {
    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash;
    next();
  } catch (error) {
    return next(error as any);
  }
});
export const ClientModel = mongoose.model<IClient>('Client', ClientSchema);

