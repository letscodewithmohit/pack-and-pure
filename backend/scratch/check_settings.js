import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Setting from '../app/models/setting.js';

dotenv.config();

const checkSettings = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const settings = await Setting.findOne().lean();
    console.log('--- CURRENT HUB SETTINGS ---');
    console.log('Hub Location (Lng, Lat):', settings?.hubLocation?.coordinates);
    console.log('Max Service Radius:', settings?.maxServiceRadius, 'km');
    console.log('Hub Address:', settings?.address);
    console.log('----------------------------');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

checkSettings();
