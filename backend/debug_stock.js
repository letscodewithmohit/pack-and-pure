import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const ProductSchema = new mongoose.Schema({
  name: String,
  stock: Number,
  variants: [mongoose.Schema.Types.Mixed],
  ownerType: String,
});

const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find({ ownerType: "seller" }).lean();
  console.log("Seller products count:", products.length);
  for (const p of products) {
    console.log("Product:", p.name);
    console.log("  Stock field in DB:", p.stock);
    console.log("  Variants:", JSON.stringify(p.variants, null, 2));
    
    // Exact match of backend logic
    const calcStock = ((p.variants && p.variants.length > 0) ? p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0) : 0) || p.stock || 0;
    
    console.log("  Calculated Stock:", calcStock);
  }
  await mongoose.disconnect();
}

check().catch(console.error);
