"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantApiKeyModel = void 0;
const mongoose_1 = require("mongoose");
const TenantApiKeySchema = new mongoose_1.Schema({
    client_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Client', required: true },
    hashedKey: { type: String, required: true, unique: true, index: true },
    label: { type: String, default: 'default' },
    active: { type: Boolean, default: true },
    lastUsedAt: { type: Date },
}, { timestamps: true });
exports.TenantApiKeyModel = (0, mongoose_1.model)('TenantApiKey', TenantApiKeySchema);
