import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { TenantApiKeyModel } from '../models/schema/auth/TenantApiKey';
import { UnauthorizedError } from '../Errors/unauthorizedError';

declare global {
    namespace Express {
        interface Request {
            tenantClientId?: string;
        }
    }
}

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
export async function tenantAuth(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-tenant-api-key'] as string | undefined;

    if (!apiKey) {
        return next(new UnauthorizedError('Missing X-Tenant-Api-Key header'));
    }

    // Hash the incoming key to compare with stored hash
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const tenantKey = await TenantApiKeyModel.findOne({ hashedKey, active: true });

    if (!tenantKey) {
        return next(new UnauthorizedError('Invalid or revoked API key'));
    }

    // Attach the client ID for downstream controllers
    req.tenantClientId = tenantKey.client_id.toString();

    // Update lastUsedAt in the background (fire-and-forget)
    TenantApiKeyModel.updateOne(
        { _id: tenantKey._id },
        { $set: { lastUsedAt: new Date() } }
    ).exec().catch(() => { /* silently ignore tracking errors */ });

    next();
}
