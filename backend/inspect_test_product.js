import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const ProductSchema = new mongoose.Schema({
  name: String,
  stock: Number,
  variants: Array,
  ownerType: String,
});

const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

async function inspectProduct() {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find({ name: "test" }).lean();
  console.log("Found products with name 'test':", JSON.stringify(products, null, 2));
  await mongoose.disconnect();
}

inspectProduct().catch(console.error);
