"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticated = authenticated;
const unauthorizedError_1 = require("../Errors/unauthorizedError");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authenticated(req, res, next) {
    const authHeader = req.headers['Authorization'] || req.headers['authorization'];
    if (!authHeader) {
        return next(new unauthorizedError_1.UnauthorizedError('No token provided'));
    }
    const token = authHeader.split(' ')[1];
    try {
        const currentUser = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = currentUser;
        next();
    }
    catch (err) {
        throw new unauthorizedError_1.UnauthorizedError("Invalid token");
    }
}
;
