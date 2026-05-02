import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function clearData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected successfully.');

    const collections = [
      'products',
      'orders',
      'transactions',
      'carts',
      'stockhistories',
      'purchaserequests',
      'deliveries',
      'hubinventories'
    ];

    for (const collectionName of collections) {
      console.log(`Clearing collection: ${collectionName}...`);
      await mongoose.connection.collection(collectionName).deleteMany({});
      console.log(`Cleared ${collectionName}.`);
    }

    console.log('\nSUCCESS: All products and order-related data have been cleared.');
    process.exit(0);
  } catch (error) {
    console.error('ERROR clearing data:', error);
    process.exit(1);
  }
}

clearData();
