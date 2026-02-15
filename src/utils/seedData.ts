import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { ThemeModel } from "../models/shema/auth/Theme";
import { PackageModel } from "../models/shema/auth/Package";
import { PaymentMethodModel } from "../models/shema/auth/PaymentMethod";
import { CouponModel } from "../models/shema/auth/Coupon";
import { ClientModel } from "../models/shema/auth/Client";

export const seedData = async () => {
    console.log("Starting database seeding...");

    try {
        // 1. Themes
        const themes = [
            { name: "Light Mode", description: "Standard light theme", theme: "light" },
            { name: "Dark Mode", description: "Standard dark theme", theme: "dark" },
            { name: "Blue Horizon", description: "Blue-tinted theme", theme: "blue" },
        ];

        for (const theme of themes) {
            await ThemeModel.updateOne(
                { theme: theme.theme },
                { $set: theme },
                { upsert: true }
            );
        }
        console.log("Themes seeded.");

        // 2. Packages
        const packages = [
            {
                name: "Basic Plan",
                description: "Entry level access",
                monthly_price: 10,
                quarterly_price: 25,
                half_yearly_price: 45,
                yearly_price: 80,
                status: true,
            },
            {
                name: "Pro Plan",
                description: "Full access for professionals",
                monthly_price: 20,
                quarterly_price: 55,
                half_yearly_price: 100,
                yearly_price: 180,
                status: true,
            },
        ];

        for (const pkg of packages) {
            await PackageModel.updateOne(
                { name: pkg.name },
                { $set: pkg },
                { upsert: true }
            );
        }
        console.log("Packages seeded.");

        // 3. Payment Methods
        const paymentMethods = [
            {
                name: "Credit Card",
                description: "Pay with Visa or Mastercard",
                logo: "https://example.com/cc-logo.png",
                status: true,
            },
            {
                name: "PayPal",
                description: "Pay securely with PayPal",
                logo: "https://example.com/paypal-logo.png",
                status: true,
            },
        ];

        for (const method of paymentMethods) {
            await PaymentMethodModel.updateOne(
                { name: method.name },
                { $set: method },
                { upsert: true }
            );
        }
        console.log("Payment Methods seeded.");

        // 4. Coupons
        const coupons = [
            {
                code: "WELCOME10",
                discount_type: "percentage",
                discount: 10,
                from: new Date(),
                to: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                status: true,
            },
            {
                code: "SAVE20",
                discount_type: "value",
                discount: 20,
                from: new Date(),
                to: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                status: true,
            },
        ];

        for (const coupon of coupons) {
            // Check if coupon exists to avoid unique constraint error on 'code'
            const existing = await CouponModel.findOne({ code: coupon.code });
            if (!existing) {
                await CouponModel.create(coupon);
            }
        }
        console.log("Coupons seeded.");

        // 5. Clients (Sample)
        const basicPackage = await PackageModel.findOne({ name: "Basic Plan" });

        if (basicPackage) {
            const clients = [
                {
                    company_name: "Acme Corp",
                    email: "contact@acme.com",
                    password: "password123", // Will be hashed by pre-save hook if creating new
                    status: "active",
                    package_id: basicPackage._id,
                }
            ];

            for (const client of clients) {
                const existing = await ClientModel.findOne({ email: client.email });
                if (!existing) {
                    await ClientModel.create(client);
                }
            }
            console.log("Clients seeded.");
        }

        console.log("Database seeding completed successfully.");
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    }
};
