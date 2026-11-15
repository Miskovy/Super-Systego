import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load env
dotenv.config();

import { ClientModel } from '../models/schema/auth/Client';
import { seedTenantCashierRole } from '../utils/seedTenantRoles';

async function seedCashierRole() {
  try {
    const mongoUri = process.env.MongoDB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MongoDB_URI is not defined in .env');
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const clients = await ClientModel.find();
    console.log(`Found ${clients.length} clients to check for Cashier role.`);

    let seededCount = 0;
    let existingCount = 0;
    let failCount = 0;

    for (const client of clients) {
      const dbName = client.db_name || `sc_${client._id}`;
      try {
        const clientDbConnection = mongoose.connection.useDb(dbName, { useCache: true });
        const rolesCollection = 'roles';
        const existingRole = await clientDbConnection
          .collection(rolesCollection)
          .findOne({ name: { $regex: /^cashier$/i } });

        if (existingRole) {
          console.log(`ℹ️ [${client.company_name} - ${dbName}] Cashier role already exists.`);
          existingCount++;
        } else {
          await seedTenantCashierRole(clientDbConnection);
          console.log(`✅ [${client.company_name} - ${dbName}] Cashier role seeded.`);
          seededCount++;
        }
      } catch (err: any) {
        console.error(`❌ [${client.company_name} - ${dbName}] Failed to seed Cashier role:`, err.message);
        failCount++;
      }
    }

    console.log(`Finished Cashier role seeding: ${seededCount} seeded, ${existingCount} already existed, ${failCount} failed.`);
  } catch (err: any) {
    console.error('Fatal script error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

seedCashierRole();
