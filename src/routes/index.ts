import { Router } from "express";
import adminRouter from './admin/index';
import tenantRouter from './tenant/tenantRoutes';
const route = Router();

route.use('/admin', adminRouter);
route.use('/tenant', tenantRouter);


export default route;