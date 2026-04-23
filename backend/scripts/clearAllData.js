import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import models
const modelDir = path.resolve(__dirname, "../app/models/");

async function clearData() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully.");

        // Define models to clear
        const collectionsToClear = [
            { name: "Order", path: "order.js" },
            { name: "OrderOtp", path: "orderOtp.js" },
            { name: "Transaction", path: "transaction.js" },
            { name: "Product", path: "product.js" },
            { name: "DeliveryAssignment", path: "deliveryAssignment.js" },
            { name: "Cart", path: "cart.js" },
            { name: "Notification", path: "notification.js" },
            { name: "Review", path: "review.js" },
            { name: "Wishlist", path: "wishlist.js" },
            { name: "Ticket", path: "ticket.js" },
            { name: "PurchaseRequest", path: "purchaseRequest.js" },
            { name: "HubInventory", path: "hubInventory.js" },
            { name: "HubInward", path: "hubInward.js" },
            { name: "StockHistory", path: "stockHistory.js" },
            { name: "Coupon", path: "coupon.js" }
        ];

        console.log("\nStarting data clearance...");
        console.log("--------------------------");

        for (const item of collectionsToClear) {
            try {
                // Dynamically import the model using pathToFileURL for Windows compatibility
                const modelFilePath = path.join(modelDir, item.path);
                const modelModule = await import(pathToFileURL(modelFilePath).href);
                const Model = modelModule.default;
                
                const result = await Model.deleteMany({});
                console.log(`✅ Cleared ${item.name}: ${result.deletedCount} documents deleted.`);
            } catch (err) {
                console.error(`❌ Error clearing ${item.name}:`, err.message);
            }
        }

        console.log("--------------------------");
        console.log("Data clearance completed.");
        console.log("NOTE: User, Seller, Delivery, PickupPartner, and Admin accounts were NOT deleted.");

        // Optional: Reset User wallet balances if needed
        // const UserModule = await import(path.join(__dirname, modelPath, "customer.js"));
        // const User = UserModule.default;
        // await User.updateMany({}, { $set: { walletBalance: 0, codCancelCount: 0, codBlocked: false } });
        // console.log("✅ Reset User wallet balances and COD status.");

    } catch (error) {
        console.error("Critical Error:", error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

clearData();
