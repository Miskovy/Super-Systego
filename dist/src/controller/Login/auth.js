"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login_admin = void 0;
const Admin_1 = require("../../models/shema/auth/Admin");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Errors_1 = require("../../Errors");
const response_1 = require("../../utils/response");
const login_admin = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new Errors_1.UnauthorizedError("Email and password are required");
    }
    const admin = await Admin_1.AdminModel.findOne({ email });
    if (!admin) {
        throw new Errors_1.UnauthorizedError("Invalid email or password");
    }
    const isPasswordValid = await bcrypt_1.default.compare(password, admin.password);
    if (!isPasswordValid) {
        throw new Errors_1.UnauthorizedError("Invalid email or password");
    }
    // توليد التوكن
    const token = jsonwebtoken_1.default.sign({
        sub: admin._id.toString(),
        name: admin.name,
        email: admin.email,
    }, process.env.JWT_SECRET, { expiresIn: "1d" });
    return (0, response_1.SuccessResponse)(res, {
        message: "Login successful",
        token,
        admin: {
            id: admin._id.toString(),
            name: admin.name,
            email: admin.email,
        },
    }, 200);
};
exports.login_admin = login_admin;
