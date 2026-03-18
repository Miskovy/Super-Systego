"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TenantController_1 = require("../../controller/tenant/TenantController");
const tenantAuth_1 = require("../../middlewares/tenantAuth");
const router = (0, express_1.Router)();
// All tenant routes require API key authentication
router.use(tenantAuth_1.tenantAuth);
// GET /api/tenant/verify - Verify tenant subscription and get feature flags
router.get('/verify', TenantController_1.verifyTenant);
exports.default = router;
