import { Router } from 'express';
import { verifyTenant } from '../../controller/tenant/TenantController';
import { tenantAuth } from '../../middlewares/tenantAuth';

const router = Router();

// All tenant routes require API key authentication
router.use(tenantAuth);

// GET /api/tenant/verify - Verify tenant subscription and get feature flags
router.get('/verify', verifyTenant);

export default router;
