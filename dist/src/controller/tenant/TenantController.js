"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTenant = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const Client_1 = require("../../models/schema/auth/Client");
const NotFound_1 = require("../../Errors/NotFound");
const response_1 = require("../../utils/response");
const unauthorizedError_1 = require("../../Errors/unauthorizedError");
/**
 * GET /api/tenant/verify
 *
 * Called by a client Systego instance to verify its subscription package
 * and check which features (ecommerce, mobile app, etc.) are enabled.
 *
 * Authentication: X-Tenant-Api-Key header (handled by tenantAuth middleware)
 * The middleware attaches req.tenantClientId before this handler runs.
 */
exports.verifyTenant = (0, express_async_handler_1.default)(async (req, res) => {
    const clientId = req.tenantClientId;
    if (!clientId) {
        throw new unauthorizedError_1.UnauthorizedError('Tenant not authenticated');
    }
    // Find the client and populate their package
    const client = await Client_1.ClientModel.findById(clientId)
        .select('company_name subdomain status package_id')
        .populate({
        path: 'package_id',
        select: 'name status haveEcommerce haveMobileApp'
    });
    if (!client) {
        throw new NotFound_1.NotFound('Tenant not found');
    }
    const packageData = client.package_id;
    const responseData = {
        tenant: {
            company_name: client.company_name,
            subdomain: client.subdomain,
            status: client.status,
        },
        features: {
            haveEcommerce: packageData?.haveEcommerce ?? false,
            haveMobileApp: packageData?.haveMobileApp ?? false,
        },
        package: {
            name: packageData?.name ?? null,
            status: packageData?.status ?? false,
        }
    };
    return (0, response_1.SuccessResponse)(res, { message: 'Tenant verified successfully', ...responseData }, 200);
});
