import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const productSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model('Product', productSchema, 'products');

const prSchema = new mongoose.Schema({}, { strict: false });
const PR = mongoose.model('PurchaseRequest', prSchema, 'purchaserequests');

async function checkStock() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('--- PRODUCT STATUS ---');
  const products = await Product.find({ name: /mike/i });
  products.forEach(p => {
    console.log(`ID: ${p._id} | Name: ${p.name} | Seller: ${p.sellerId} | Stock: ${p.stock} | Type: ${p.ownerType}`);
  });

  console.log('\n--- RECENT PRs FOR THIS PRODUCT ---');
  const prs = await PR.find({ product: /mike/i }).sort({ createdAt: -1 }).limit(5);
  prs.forEach(pr => {
    console.log(`ID: ${pr.requestId} | Status: ${pr.status} | Qty: ${pr.items?.[0]?.requiredQty} | Cost: ${pr.items?.[0]?.vendorUnitCost}`);
  });

  await mongoose.disconnect();
}

checkStock();
