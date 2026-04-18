import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function checkGhost() {
    await mongoose.connect(process.env.MONGO_URI);
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    
    // Find ALL seller products and check their master links
    const sellers = await Product.find({ ownerType: 'seller' }).lean();
    console.log(`Checking ${sellers.length} seller products...`);
    
    for (const p of sellers) {
        if (!p.masterProductId) {
            console.log(`[ORPHAN] ${p.name} has NO master link.`);
            continue;
        }
        
        const master = await Product.findById(p.masterProductId);
        if (!master) {
            console.log(`[GHOST] ${p.name} is linked to a ghost ID: ${p.masterProductId}`);
        } else {
            console.log(`[OK] ${p.name} linked to ${master.name} (${master._id})`);
        }
    }
    
    process.exit(0);
}

checkGhost();
