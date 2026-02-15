"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const plainPassword = "12345678";
// Hashing
const hashedPassword = await bcrypt_1.default.hash(plainPassword, 10); // 10 is the salt rounds
console.log("Hashed password:", hashedPassword);
