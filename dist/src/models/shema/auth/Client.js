"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientModel = void 0;
const mongoose_1 = require("mongoose");
const mongoose_2 = __importDefault(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const ClientSchema = new mongoose_1.Schema({
    company_name: { type: String, },
    email: { type: String, unique: true },
    password: { type: String },
    status: { type: String },
    package_id: { type: mongoose_1.Types.ObjectId, ref: 'Package' },
}, { timestamps: true, });
ClientSchema.pre("save", async function (next) {
    if (!this.isModified("password") || !this.password)
        return next();
    try {
        const hash = await bcrypt_1.default.hash(this.password, 10);
        this.password = hash;
        next();
    }
    catch (error) {
        return next(error);
    }
});
exports.ClientModel = mongoose_2.default.model('Client', ClientSchema);
