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
const ClientProvisioner_1 = require("../utils/ClientProvisioner");
async function migrateLogos() {
    try {
        if (!process.env.MongoDB_URI) {
            throw new Error('MongoDB_URI is not defined in .env');
        }
        await mongoose_1.default.connect(process.env.MongoDB_URI);
        console.log('Connected to DB');
        const clients = await Client_1.ClientModel.find({ subdomain: { $exists: true, $ne: null } });
        console.log(`Found ${clients.length} clients to process.`);
        for (const client of clients) {
            if (!client.subdomain)
                continue;
            console.log(`Processing client: ${client.company_name} (subdomain: ${client.subdomain})`);
            try {
                const logoBase64 = await (0, ClientProvisioner_1.getClientLogoBase64)(client.subdomain);
                if (logoBase64) {
                    client.logoBase64 = logoBase64;
                    await client.save();
                    console.log(`✅ Successfully updated logo for ${client.company_name}`);
                }
                else {
                    console.log(`⚠️ No logo found for ${client.company_name}`);
                }
            }
            catch (err) {
                console.error(`❌ Error fetching logo for ${client.company_name}:`, err.message);
            }
        }
        console.log('Migration complete.');
    }
    catch (err) {
        console.error('Migration failed:', err);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
migrateLogos();
