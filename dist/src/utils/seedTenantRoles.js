"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedTenantCashierRole = exports.buildCashierRoleData = exports.CASHIER_MODULE_DEFINITIONS = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
exports.CASHIER_MODULE_DEFINITIONS = [
    { module: 'category', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'product', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'brand', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'variation', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'product_warehouse', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'Taxes', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'discount', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'stock', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'POS', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'sales', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'customer', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'customer_group', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'cashier', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'cashier_shift', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'cashier_shift_report', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'orders', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'installments', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'transfer', actions: ["View", "Add", "Edit", "Delete", "Status"] },
    { module: 'warehouse', actions: ["View"] },
    { module: 'all_returns', actions: ["View", "Add", "Edit", "Delete", "Status"] },
];
const buildCashierRoleData = () => {
    const permissions = exports.CASHIER_MODULE_DEFINITIONS.map((item) => ({
        module: item.module,
        actions: item.actions.map((act) => ({
            _id: new mongoose_1.default.Types.ObjectId(),
            action: act,
        })),
    }));
    return {
        _id: new mongoose_1.default.Types.ObjectId(),
        name: 'Cashier',
        status: 'active',
        permissions,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
};
exports.buildCashierRoleData = buildCashierRoleData;
const seedTenantCashierRole = async (tenantDbConnection) => {
    const rolesCollection = 'roles';
    // Ensure collection exists
    try {
        await tenantDbConnection.createCollection(rolesCollection);
    }
    catch (err) {
        // Collection might already exist, ignore namespace exists error
    }
    const existingRole = await tenantDbConnection
        .collection(rolesCollection)
        .findOne({ name: { $regex: /^cashier$/i } });
    if (existingRole) {
        console.log(`[SeedTenantRoles] Cashier role already exists in database "${tenantDbConnection.name}"`);
        return existingRole;
    }
    const cashierRoleData = (0, exports.buildCashierRoleData)();
    await tenantDbConnection.collection(rolesCollection).insertOne(cashierRoleData);
    try {
        await tenantDbConnection.collection(rolesCollection).createIndex({ name: 1 }, { unique: true });
    }
    catch (idxErr) {
        console.warn(`[SeedTenantRoles] Could not create index on roles.name: ${idxErr.message}`);
    }
    console.log(`[SeedTenantRoles] Cashier role successfully seeded in database "${tenantDbConnection.name}"`);
    return cashierRoleData;
};
exports.seedTenantCashierRole = seedTenantCashierRole;
