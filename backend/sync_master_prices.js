import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  salePrice: Number,
  ownerType: String,
});

const HubInventorySchema = new mongoose.Schema({
  productId: mongoose.Schema.Types.ObjectId,
  sellPrice: Number,
});

const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);
const HubInventory = mongoose.models.HubInventory || mongoose.model("HubInventory", HubInventorySchema);

async function syncAll() {
  await mongoose.connect(process.env.MONGO_URI);
  const masterProducts = await Product.find({ ownerType: "admin" }).lean();
  console.log(`Found ${masterProducts.length} master products.`);
  for (const p of masterProducts) {
    const pPrice = Number(p.salePrice || p.price || 0);
    if (pPrice > 0) {
      const res = await HubInventory.updateMany({ productId: p._id }, { $set: { sellPrice: pPrice } });
      console.log(`Synced master product '${p.name}' price ₹${pPrice} to HubInventory. (Modified ${res.modifiedCount} rows)`);
    }
  }
  await mongoose.disconnect();
}

syncAll().catch(console.error);
