"use strict";
// import { NextFunction, Request, Response, RequestHandler } from "express";
// import { UnauthorizedError } from "../Errors/unauthorizedError";
// export const authorizeRoles = (...roles: string[]): RequestHandler => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     if (!req.user?.role || !roles.includes(req.user.role)) {
//       throw new UnauthorizedError();
//     }
//     next();
//   };
// };
// import { NextFunction, Request, Response, RequestHandler } from "express";
// import { UnauthorizedError } from "../Errors/unauthorizedError";
// import { AppUser } from "../types/custom"; // نوع المستخدم
// import { AdminModel } from "../models/shema/auth/Admin";
// import jwt from "jsonwebtoken";
// export const authorizeRoles = (...roles: string[]): RequestHandler => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     if (!req.user) {
//       return next(new UnauthorizedError("User not authenticated"));
//     }
//     // ✅ Super Admin يدخل من غير شروط
//     if (req.user.isSuperAdmin) {
//       return next();
//     }
//     // ✅ لو مفيش role أو الرول مش ضمن المسموح
//     if (!req.user.role || !roles.includes(req.user.role)) {
//       return next(new UnauthorizedError("You don't have permission"));
//     }
//     next();
//   };
// };
// export const authorizePermissions = (...permissions: string[]): RequestHandler => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     if (!req.user) {
//       return next(new UnauthorizedError("User not authenticated"));
//     }
//     // ✅ Super Admin يتخطى كل شيء
//     if (req.user.isSuperAdmin) return next();
//     // ✅ دمج صلاحيات الدور مع الصلاحيات المخصصة
//     const userPermissions = new Set([
//       ...(req.user.rolePermissions || []),
//       ...(req.user.customPermissions || []),
//     ]);
//     // ✅ تحقق أن المستخدم يمتلك كل الصلاحيات المطلوبة
//     const missingPerms = permissions.filter((perm) => !userPermissions.has(perm));
//     if (missingPerms.length > 0) {
//       return next(
//         new UnauthorizedError(`Missing permissions: ${missingPerms.join(", ")}`)
//       );
//     }
//     next();
//   };
// };
// export const auth = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const token = (req.headers.authorization || "").replace("Bearer ", "");
//     if (!token) return next(new UnauthorizedError("No token provided"));
//     // ✅ التحقق من صحة الـ JWT
//     const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
//     // ✅ البحث عن Admin وربط الدور
//     const admin = await AdminModel.findById(payload.sub).populate({ path: "role", select: "permissions" });
//     if (!admin) return next(new UnauthorizedError("Admin not found"));
//     // ✅ ملء req.user مع كل الصلاحيات
//     const rolePermissions = Array.isArray((admin.role as any)?.permissions)
//       ? (admin.role as any).permissions
//       : [];
//     req.user = {
//       id: admin._id.toString(),
//       name: admin.name,
//       email: admin.email,
//       isSuperAdmin: admin.isSuperAdmin,
//       customPermissions: admin.customPermissions || [],
//       rolePermissions,
//     };
//     next();
//   } catch (err) {
//     next(new UnauthorizedError("Invalid or expired token"));
//   }
// };
