import { Router } from 'express';
import { login_admin } from '../../controller/Login/auth';
// import { authenticated } from '../../middlewares/authenticated';
import { validate } from '../../middlewares/validation';
import { loginSchema } from '../../validation/user/auth';
import { catchAsync } from '../../utils/catchAsync';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema),catchAsync( login_admin));

// Export the authRouter to be used in the main app
export default authRouter;