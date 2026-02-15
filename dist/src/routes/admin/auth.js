"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../controller/Login/auth");
// import { authenticated } from '../../middlewares/authenticated';
const validation_1 = require("../../middlewares/validation");
const auth_2 = require("../../validation/user/auth");
const catchAsync_1 = require("../../utils/catchAsync");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/login', (0, validation_1.validate)(auth_2.loginSchema), (0, catchAsync_1.catchAsync)(auth_1.login_admin));
// Export the authRouter to be used in the main app
exports.default = exports.authRouter;
