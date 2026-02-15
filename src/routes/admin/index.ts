import { Router } from "express";
import authRouter from "./auth";
import CouponRouter from "./CouponRoutes";
import PackageRouter from "./PackageRoutes";
import ClientRoutes from "./clientRoutes";
import PaymentMethodRoutes from "./paymentMethodRoutes";
import ThemeRoutes from "./themesRoutes";
import router from "./clientRoutes";
//import { authenticated } from "../../middlewares/authenticated";
//import {  authorizeRoles } from "../../middlewares/authorized";

export const route = Router();

route.use("/auth", authRouter);
// route.use(authenticated,authorizeRoles("admin"));

route.use("/coupons", CouponRouter);
route.use("/packages", PackageRouter);
route.use("/clients", ClientRoutes);
route.use("/payment-methods", PaymentMethodRoutes);
route.use("/themes", ThemeRoutes);

export default route;