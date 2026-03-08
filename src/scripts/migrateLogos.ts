import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config();

import { ClientModel } from '../models/schema/auth/Client';
import { getClientLogoBase64 } from '../utils/ClientProvisioner';

async function migrateLogos() {
    try {
        if (!process.env.MongoDB_URI) {
            throw new Error('MongoDB_URI is not defined in .env');
        }
        await mongoose.connect(process.env.MongoDB_URI);
        console.log('Connected to DB');

        const clients = await ClientModel.find({ subdomain: { $exists: true, $ne: null } });
        console.log(`Found ${clients.length} clients to process.`);

        for (const client of clients) {
            if (!client.subdomain) continue;

            console.log(`Processing client: ${client.company_name} (subdomain: ${client.subdomain})`);

            try {
                const logoBase64 = await getClientLogoBase64(client.subdomain);
                if (logoBase64) {
                    client.logoBase64 = logoBase64;
                    await client.save();
                    console.log(`✅ Successfully updated logo for ${client.company_name}`);
                } else {
                    console.log(`⚠️ No logo found for ${client.company_name}`);
                }
            } catch (err: any) {
                console.error(`❌ Error fetching logo for ${client.company_name}:`, err.message);
            }
        }

        console.log('Migration complete.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

migrateLogos();
