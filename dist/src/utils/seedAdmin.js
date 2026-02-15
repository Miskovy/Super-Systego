"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAdminFromEnv = seedAdminFromEnv;
const bcrypt_1 = __importDefault(require("bcrypt"));
const Admin_1 = require("../models/shema/auth/Admin");
async function seedAdminFromEnv() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || "Super Admin";
    if (!adminEmail || !adminPassword) {
        return; // Nothing to seed without credentials
    }
    const existing = await Admin_1.AdminModel.findOne({ email: adminEmail });
    if (existing) {
        return;
    }
    const hashedPassword = await bcrypt_1.default.hash(adminPassword, 10);
    await Admin_1.AdminModel.create({ name: adminName, email: adminEmail, password: hashedPassword });
    // eslint-disable-next-line no-console
    console.log(`Seeded admin user with email: ${adminEmail}`);
}
