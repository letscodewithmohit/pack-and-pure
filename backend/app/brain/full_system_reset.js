import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const mongoUri = process.env.MONGO_URI;

async function fullSystemReset() {
  if (!mongoUri) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
  }

  try {
    console.log("Connecting to Database for FULL RESET...");
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    
    // 1. Collections to completely wipe (EVERYTHING except Admins)
    const collectionsToWipe = [
        "users",
        "sellers",
        "deliveries",
        "pickuppartners",
        "wallets",
        "ledgerentries",
        "reviews",
        "tickets",
        "wishlists",
        "financeauditlogs",
        "stockhistories",
        "deliveryassignments",
        "orderotps",
        "carts",
        "orders",
        "purchaserequests",
        "hubinwards",
        "hubinventories",
        "transactions",
        "notifications",
        "payments",
        "payouts",
        "paymentwebhookevents",
        "geocodecaches",
        "products",
        "categories",
        "subcategories",
        "headers",
        "experience_sections",
        "offersections",
        "offers",
        "heroconfigs"
    ];

    console.log("Starting full deletion of all accounts (except Admins) and operational data...");

    for (const collName of collectionsToWipe) {
        try {
            const result = await db.collection(collName).deleteMany({});
            console.log(`[DELETE] Wiped ${result.deletedCount} records from ${collName}`);
        } catch (e) {
            console.warn(`[SKIP] Collection ${collName} not found or inaccessible.`);
        }
    }

    // 2. Clear Admin non-essential data but KEEP the accounts
    try {
        const adminResult = await db.collection("admins").updateMany({}, {
            $set: {
                lastLogin: null,
                fcmTokens: []
            }
        });
        console.log(`[RESET] Cleaned sessions for ${adminResult.modifiedCount} Admin accounts (Identities preserved).`);
    } catch (e) {
        console.error("[ERROR] Admin cleanup failed:", e.message);
    }

    console.log("\n=======================================================");
    console.log("SUCCESS: FULL SYSTEM RESET COMPLETE");
    console.log("All Customers, Sellers, Riders, and Products deleted.");
    console.log("Admins are preserved so you can log in and start fresh.");
    console.log("=======================================================");
    
    process.exit(0);
  } catch (error) {
    console.error("CRITICAL ERROR during full reset:", error);
    process.exit(1);
  }
}

fullSystemReset();
