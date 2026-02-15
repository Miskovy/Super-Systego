import bcrypt from "bcrypt";
import { AdminModel } from "../models/shema/auth/Admin";

export async function seedAdminFromEnv(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "Super Admin";

  if (!adminEmail || !adminPassword) {
    return; // Nothing to seed without credentials
  }

  const existing = await AdminModel.findOne({ email: adminEmail });
  if (existing) {
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  await AdminModel.create({ name: adminName, email: adminEmail, password: hashedPassword });
  // eslint-disable-next-line no-console
  console.log(`Seeded admin user with email: ${adminEmail}`);
}


