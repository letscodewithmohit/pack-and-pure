import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function checkMaster() {
    await mongoose.connect(process.env.MONGO_URI);
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    
    // Check the specific Master ID found for egg plates
    const master = await Product.findById("69e326e0c6b2147610123108");
    console.log("Master Item details:", JSON.stringify(master, null, 2));
    
    process.exit(0);
}

checkMaster();
