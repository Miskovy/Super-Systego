"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const connection_1 = require("./models/connection");
const seedData_1 = require("./utils/seedData");
dotenv_1.default.config();
const runSeed = async () => {
    try {
        await (0, connection_1.connectDB)();
        await (0, seedData_1.seedData)();
        console.log("Seeding complete. Exiting...");
        process.exit(0);
    }
    catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};
runSeed();
