import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const ProductSchema = new mongoose.Schema({
    name: String,
    ownerType: String,
    status: String,
    masterProductId: mongoose.Schema.Types.ObjectId,
    sellerId: mongoose.Schema.Types.ObjectId
}, { strict: false });

const Product = mongoose.model('Product', ProductSchema);

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const p = await Product.findOne({ name: /egg plates/i });
    console.log("Product found:", JSON.stringify(p, null, 2));
    process.exit(0);
}

check();
