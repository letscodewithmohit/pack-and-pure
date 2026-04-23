import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const mongoUri = process.env.MONGO_URI;

async function clearEntityData() {
  if (!mongoUri) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
  }

  try {
    console.log("Connecting to Database...");
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    
    // 1. Collections to completely wipe (Transactional/Activity data)
    const collectionsToWipe = [
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

    for (const collName of collectionsToWipe) {
        try {
            const result = await db.collection(collName).deleteMany({});
            console.log(`[WIPE] Deleted ${result.deletedCount} records from ${collName}`);
        } catch (e) {
            console.warn(`[SKIP] Collection ${collName} not found or inaccessible.`);
        }
    }

    // 2. Partial Reset of Account Data (Keeping the accounts but clearing their activity data)
    
    // Reset Users (Customers)
    try {
        const userResult = await db.collection("users").updateMany({}, {
            $set: {
                walletBalance: 0,
                codCancelCount: 0,
                codBlocked: false,
                addresses: [], // Clear saved addresses
                fcmTokens: [],
                lastLogin: null
            }
        });
        console.log(`[RESET] Updated ${userResult.modifiedCount} User accounts (Cleared wallets, addresses, and COD strikes).`);
    } catch (e) {
        console.error("[ERROR] User reset failed:", e.message);
    }

    // Reset Sellers (Vendors)
    try {
        const sellerResult = await db.collection("sellers").updateMany({}, {
            $set: {
                fcmTokens: [],
                lastLogin: null
                // We keep shopName, email, phone, location as they define the 'Account'
            }
        });
        console.log(`[RESET] Updated ${sellerResult.modifiedCount} Seller accounts (Cleared sessions).`);
    } catch (e) {
        console.error("[ERROR] Seller reset failed:", e.message);
    }

    // Reset Delivery Boys (Riders)
    try {
        const deliveryResult = await db.collection("deliveries").updateMany({}, {
            $set: {
                isOnline: true,
                lastLocationAt: null,
                fcmTokens: [],
                lastLogin: null
                // We keep documents, vehicle info, and account info
            }
        });
        console.log(`[RESET] Updated ${deliveryResult.modifiedCount} Delivery Partner accounts.`);
    } catch (e) {
        console.error("[ERROR] Delivery reset failed:", e.message);
    }

    // Reset Pickup Partners
    try {
        const pickupResult = await db.collection("pickuppartners").updateMany({}, {
            $set: {
                status: "available",
                isActive: true,
                lastLogin: null
            }
        });
        console.log(`[RESET] Updated ${pickupResult.modifiedCount} Pickup Partner accounts.`);
    } catch (e) {
        console.error("[ERROR] Pickup Partner reset failed:", e.message);
    }

    console.log("\nEntity data cleanup successful. Accounts preserved, Catalog (Products & Categories) and Activity data cleared.");
    process.exit(0);
  } catch (error) {
    console.error("CRITICAL ERROR:", error);
    process.exit(1);
  }
}

clearEntityData();
