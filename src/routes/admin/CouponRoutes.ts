import { Router } from 'express';
import { view, create, modify, delete_item, getCouponById } from '../../controller/admin/CouponController';
 import { authenticated } from '../../middlewares/authenticated';
import { validate } from '../../middlewares/validation';
import { loginSchema } from '../../validation/user/auth';
import { catchAsync } from '../../utils/catchAsync';

export const CouponRouter = Router();

CouponRouter.use(authenticated)

CouponRouter.get('/' ,catchAsync( view));
CouponRouter.get('/:id', catchAsync(getCouponById))
CouponRouter.post('/add' ,catchAsync( create));
CouponRouter.put('/update/:id' ,catchAsync( modify));
CouponRouter.delete('/delete_item/:id' ,catchAsync( delete_item));

// Export the CouponRouter to be used in the main app
export default CouponRouter;