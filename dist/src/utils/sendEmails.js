"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const sendEmail = async (to, subject, text) => {
    console.log("Email user:", process.env.EMAIL_USER);
    console.log("Email pass:", process.env.EMAIL_PASS ? "Exists" : "Missing");
    const transporter = nodemailer_1.default.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    try {
        const info = await transporter.sendMail({
            from: `"Smart_collge" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
        });
        console.log("✅ Email sent:", info.response);
    }
    catch (error) {
        console.error("❌ Email error:", error);
    }
};
exports.sendEmail = sendEmail;
// import SibApiV3Sdk from "sib-api-v3-sdk";
// // إعداد Brevo API
// const client = SibApiV3Sdk.ApiClient.instance;
// client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY!;
// const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
// // دالة لإرسال الإيميل
// export const sendEmail = async (to: string, subject: string, text: string) => {
//   try {
//     await apiInstance.sendTransacEmail({
//       sender: { email: process.env.BREVO_SENDER_EMAIL!, name: "Smart College" },
//       to: [{ email: to }],
//       subject,
//       textContent: text,
//     });
//     console.log("✅ Email sent via Brevo API");
//   } catch (error) {
//     console.error("❌ Email error:", error);
//   }
// };
