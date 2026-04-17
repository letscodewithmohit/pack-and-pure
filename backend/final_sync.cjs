const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const syncLogic = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const HubInventory = mongoose.connection.collection('hubinventories');
        const Product = mongoose.connection.collection('products');
        
        const adminProducts = await Product.find({ ownerType: 'admin' }).toArray();
        for (const p of adminProducts) {
            const hubInv = await HubInventory.findOne({ productId: p._id });
            if (hubInv) {
                // Set product root stock equal to hub inventory available qty
                await Product.updateOne({ _id: p._id }, { $set: { stock: hubInv.availableQty } });
                console.log(`Synced ${p.name} to ${hubInv.availableQty}`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

syncLogic();
