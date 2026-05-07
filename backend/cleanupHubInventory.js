import mongoose from "mongoose";
import HubInventory from "./app/models/hubInventory.js";
import Product from "./app/models/product.js";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/Quick_commerce";

async function cleanup() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const allInventory = await HubInventory.find({}).lean();
    console.log(`Found ${allInventory.length} inventory records`);

    for (const row of allInventory) {
      const product = await Product.findById(row.productId).select("masterProductId ownerType name");
      
      if (!product) {
        console.log(`[Orphan] Product ${row.productId} not found. Deleting inventory row.`);
        await HubInventory.deleteOne({ _id: row._id });
        continue;
      }

      if (product.ownerType === "seller" && product.masterProductId) {
        const masterId = String(product.masterProductId);
        console.log(`[Duplicate Found] Product "${product.name}" (Seller ID: ${row.productId}) should be Master ID: ${masterId}`);

        // Find or create Master Inventory Row
        let masterRow = await HubInventory.findOne({ hubId: row.hubId, productId: masterId });
        
        if (masterRow) {
          // Merge stock
          console.log(`Merging ${row.availableQty} into existing Master record (${masterRow.availableQty})`);
          masterRow.availableQty += (row.availableQty || 0);
          masterRow.reservedQty += (row.reservedQty || 0);
          // Keep the best prices
          if (row.sellPrice > 0 && (!masterRow.sellPrice || masterRow.sellPrice === 0)) {
            masterRow.sellPrice = row.sellPrice;
          }
          await masterRow.save();
          
          // Delete the seller-bound row
          await HubInventory.deleteOne({ _id: row._id });
          console.log(`Merged and deleted seller-bound row.`);
        } else {
          // Update the existing row to point to Master ID
          console.log(`No Master record found. Updating current row to point to Master ID.`);
          await HubInventory.updateOne({ _id: row._id }, { $set: { productId: masterId } });
        }
      }
    }

    console.log("Cleanup complete!");
    process.exit(0);
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exit(1);
  }
}

cleanup();
