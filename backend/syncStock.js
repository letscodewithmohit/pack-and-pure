import mongoose from "mongoose";
import Product from "./app/models/product.js";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/Quick_commerce";

async function syncStock() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const products = await Product.find({});
    console.log(`Found ${products.length} products to sync`);

    for (const product of products) {
      if (product.variants && product.variants.length > 0) {
        const totalStock = product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
        
        if (product.stock !== totalStock) {
          console.log(`[Sync] Product "${product.name}" (${product._id}): Stock ${product.stock} -> ${totalStock}`);
          product.stock = totalStock;
          await product.save();
        }
      }
    }

    console.log("Stock sync complete!");
    process.exit(0);
  } catch (err) {
    console.error("Sync failed:", err);
    process.exit(1);
  }
}

syncStock();
