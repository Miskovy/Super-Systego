// Mongoose schema for Client
import { Schema, model, Types, Document } from "mongoose";
import bcrypt from 'bcrypt';

interface IClient {
  company_name?: string;
  email?: string;
  password?: string;
  status?: string;
  package_id?: Types.ObjectId;
  db_name?: string;
  subdomain?: string;
  subdomain_url?: string;
}

const ClientSchema = new Schema<IClient>(
  {
    company_name: { type: String, },
    email: { type: String, unique: true },
    password: { type: String },
    status: { type: String },
    package_id: { type: Schema.Types.ObjectId, ref: 'Package' },
    db_name: { type: String },
    subdomain: { type: String, unique: true, sparse: true },
    subdomain_url: { type: String },
  },
  { timestamps: true, }
);

ClientSchema.pre("save", async function (this: IClient & Document, next: (err?: any) => void) {
  if (!this.isModified("password") || !this.password) return next();
  try {
    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash;
    next();
  } catch (error) {
    return next(error);
  }
});
export const ClientModel = model<IClient>('Client', ClientSchema);

