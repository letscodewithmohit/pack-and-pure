
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from './app/models/seller.js';

dotenv.config();

const checkSellers = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        console.log('Connecting to:', uri ? uri.split('@')[1] : 'Localhost');
        
        await mongoose.connect(uri);
        console.log('Connected to Atlas DB');

        const allSellers = await Seller.find({});
        console.log(`Total Sellers in DB: ${allSellers.length}`);
        
        allSellers.forEach(s => {
            console.log(`- Shop: ${s.shopName}, Verified: ${s.isVerified}, Active: ${s.isActive}, Role: ${s.role}`);
        });

        const verifiedSellers = await Seller.find({ isVerified: true });
        console.log(`Verified Sellers Count: ${verifiedSellers.length}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkSellers();
