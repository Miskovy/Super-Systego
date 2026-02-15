"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const google_1 = __importDefault(require("./google"));
const route = (0, express_1.Router)();
route.use('/local', auth_1.default);
route.use('/google', google_1.default);
exports.default = route;
