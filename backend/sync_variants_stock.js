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

async function synchronizeExistingProducts() {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find({}).lean();
  console.log(`Analyzing ${products.length} products...`);

  for (const p of products) {
    let variantsChanged = false;
    const syncedVariants = (p.variants || []).map(v => {
      if (v.stock === null || v.stock === undefined || Number(v.stock) === 0) {
        if (p.stock > 0) {
          variantsChanged = true;
          return { ...v, stock: p.stock };
        }
      }
      return v;
    });

    if (variantsChanged) {
      await Product.updateOne({ _id: p._id }, { $set: { variants: syncedVariants } });
      console.log(`Fixed missing variant stocks for product '${p.name}' (${p._id})`);
    }

    if (p.variants && p.variants.length > 0) {
      const vSum = p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      if (vSum > 0 && p.stock === 0) {
        await Product.updateOne({ _id: p._id }, { $set: { stock: vSum } });
        console.log(`Synchronized parent stock to variant sum (${vSum}) for product '${p.name}'`);
      }
    }
  }

  await mongoose.disconnect();
}

synchronizeExistingProducts().catch(console.error);
