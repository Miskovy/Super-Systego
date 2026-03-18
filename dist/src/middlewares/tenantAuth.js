"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantAuth = tenantAuth;
const crypto_1 = __importDefault(require("crypto"));
const TenantApiKey_1 = require("../models/schema/auth/TenantApiKey");
const unauthorizedError_1 = require("../Errors/unauthorizedError");
/**
 * Middleware to authenticate tenant API requests via the X-Tenant-Api-Key header.
 *
 * Flow:
 * 1. Extract raw key from X-Tenant-Api-Key header
 * 2. Hash it with SHA-256
 * 3. Look up TenantApiKey by hashed value
 * 4. Verify the key is active
 * 5. Attach client_id to req.tenantClientId
 * 6. Update lastUsedAt timestamp (fire-and-forget)
 */
async function tenantAuth(req, res, next) {
    const apiKey = req.headers['x-tenant-api-key'];
    if (!apiKey) {
        return next(new unauthorizedError_1.UnauthorizedError('Missing X-Tenant-Api-Key header'));
    }
    // Hash the incoming key to compare with stored hash
    const hashedKey = crypto_1.default.createHash('sha256').update(apiKey).digest('hex');
    const tenantKey = await TenantApiKey_1.TenantApiKeyModel.findOne({ hashedKey, active: true });
    if (!tenantKey) {
        return next(new unauthorizedError_1.UnauthorizedError('Invalid or revoked API key'));
    }
    // Attach the client ID for downstream controllers
    req.tenantClientId = tenantKey.client_id.toString();
    // Update lastUsedAt in the background (fire-and-forget)
    TenantApiKey_1.TenantApiKeyModel.updateOne({ _id: tenantKey._id }, { $set: { lastUsedAt: new Date() } }).exec().catch(() => { });
    next();
}
