import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const ProductSchema = new mongoose.Schema({
  name: String,
  sku: String,
});

const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

async function fixSkus() {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find({}).lean();
  console.log(`Found ${products.length} products.`);
  
  const existingSkus = new Set();
  
  for (const p of products) {
    if (!p.sku || p.sku.trim() === "" || existingSkus.has(p.sku)) {
      let uniqueSku = `SKU-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      while (existingSkus.has(uniqueSku)) {
        uniqueSku = `SKU-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      await Product.updateOne({ _id: p._id }, { $set: { sku: uniqueSku } });
      console.log(`Updated product '${p.name}' with unique SKU: ${uniqueSku}`);
      existingSkus.add(uniqueSku);
    } else {
      existingSkus.add(p.sku);
    }
  }
  await mongoose.disconnect();
}

fixSkus().catch(console.error);
