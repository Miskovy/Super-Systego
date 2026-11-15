"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load env
dotenv_1.default.config();
const Client_1 = require("../models/schema/auth/Client");
const seedTenantRoles_1 = require("../utils/seedTenantRoles");
async function seedCashierRole() {
    try {
        const mongoUri = process.env.MongoDB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MongoDB_URI is not defined in .env');
        }
        await mongoose_1.default.connect(mongoUri);
        console.log('Connected to MongoDB');
        const clients = await Client_1.ClientModel.find();
        console.log(`Found ${clients.length} clients to check for Cashier role.`);
        let seededCount = 0;
        let existingCount = 0;
        let failCount = 0;
        for (const client of clients) {
            const dbName = client.db_name || `sc_${client._id}`;
            try {
                const clientDbConnection = mongoose_1.default.connection.useDb(dbName, { useCache: true });
                const rolesCollection = 'roles';
                const existingRole = await clientDbConnection
                    .collection(rolesCollection)
                    .findOne({ name: { $regex: /^cashier$/i } });
                if (existingRole) {
                    console.log(`ℹ️ [${client.company_name} - ${dbName}] Cashier role already exists.`);
                    existingCount++;
                }
                else {
                    await (0, seedTenantRoles_1.seedTenantCashierRole)(clientDbConnection);
                    console.log(`✅ [${client.company_name} - ${dbName}] Cashier role seeded.`);
                    seededCount++;
                }
            }
            catch (err) {
                console.error(`❌ [${client.company_name} - ${dbName}] Failed to seed Cashier role:`, err.message);
                failCount++;
            }
        }
        console.log(`Finished Cashier role seeding: ${seededCount} seeded, ${existingCount} already existed, ${failCount} failed.`);
    }
    catch (err) {
        console.error('Fatal script error:', err.message);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
seedCashierRole();
