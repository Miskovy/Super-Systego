import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { ClientModel } from '../../models/schema/auth/Client';
import { NotFound } from '../../Errors/NotFound';
import { SuccessResponse } from '../../utils/response';
import { UnauthorizedError } from '../../Errors/unauthorizedError';

/**
 * GET /api/tenant/verify
 * 
 * Called by a client Systego instance to verify its subscription package
 * and check which features (ecommerce, mobile app, etc.) are enabled.
 * 
 * Authentication: X-Tenant-Api-Key header (handled by tenantAuth middleware)
 * The middleware attaches req.tenantClientId before this handler runs.
 */
export const verifyTenant = asyncHandler(async (req: Request, res: Response) => {
    const clientId = req.tenantClientId;

    if (!clientId) {
        throw new UnauthorizedError('Tenant not authenticated');
    }

    // Find the client and populate their package
    const client = await ClientModel.findById(clientId)
        .select('company_name subdomain status package_id')
        .populate({
            path: 'package_id',
            select: 'name status haveEcommerce haveMobileApp havePOS haveReports haveStockTake',
        });

    if (!client) {
        throw new NotFound('Tenant not found');
    }

    const packageData = client.package_id as any;

    const responseData = {
        tenant: {
            company_name: client.company_name,
            subdomain: client.subdomain,
            status: client.status,
        },
        features: {
            haveEcommerce: packageData?.haveEcommerce ?? false,
            haveMobileApp: packageData?.haveMobileApp ?? false,
            havePOS: packageData?.havePOS ?? false,
            haveReports: packageData?.haveReports ?? false,
            haveStockTake: packageData?.haveStockTake ?? false,
        },
        package: {
            name: packageData?.name ?? null,
            status: packageData?.status ?? false,
        }
    };

    return SuccessResponse(res, { message: 'Tenant verified successfully', ...responseData }, 200);
});
