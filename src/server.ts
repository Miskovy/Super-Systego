import express from "express";
import http from "http";
import { Server } from "socket.io";
import ApiRoute from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { NotFound } from "./Errors";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { connectDB } from "./models/connection";
import { seedAdminFromEnv } from "./utils/seedAdmin";

// Load environment variables
dotenv.config();

const app = express();
connectDB().then(seedAdminFromEnv).catch(() => { });

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: "*" }));
app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api", ApiRoute);

app.use((req, res, next) => {
  throw new NotFound("Route not found");
});
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// ربط Socket.IO

// Increase server timeouts for long-running provisioning tasks (5 minutes)
server.timeout = 300000;
server.keepAliveTimeout = 300000;
server.headersTimeout = 301000;

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
