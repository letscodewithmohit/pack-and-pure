import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const ProductSchema = new mongoose.Schema({
  name: String,
  stock: Number,
  variants: Array,
  ownerType: String,
  masterProductId: mongoose.Schema.Types.ObjectId,
});

const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

async function testStockLogic() {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find({ name: "test" }).lean();
  console.log("Products count:", products.length);

  products.forEach(p => {
    console.log(`\nProduct name: ${p.name}, ownerType: ${p.ownerType}, masterProductId: ${p.masterProductId}`);
    console.log("Original stock field:", p.stock);
    console.log("Variants array:", JSON.stringify(p.variants, null, 2));

    const vSum = (p.variants && p.variants.length > 0) ? p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0) : 0;
    const calcStock = vSum > 0 ? vSum : (p.stock || 0);
    console.log(`Calculated stock (vSum): ${vSum}`);
    console.log(`Calculated calcStock: ${calcStock}`);
  });

  await mongoose.disconnect();
}

testStockLogic().catch(console.error);
