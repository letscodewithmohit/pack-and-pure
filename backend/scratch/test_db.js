import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dnsq from 'dns';
const dns = dnsq.promises;

dotenv.config();

const uri = process.env.MONGO_URI;
console.log('Testing URI:', uri);

async function testDNS() {
    console.log('\n--- DNS Resolution Test ---');
    const host = uri.split('@')[1].split('/')[0].split('?')[0];
    console.log('Main Host:', host);
    
    try {
        if (uri.startsWith('mongodb+srv')) {
            console.log('Resolving SRV record for:', `_mongodb._tcp.${host}`);
            const srv = await dns.resolveSrv(`_mongodb._tcp.${host}`);
            console.log('SRV Records found:', srv);
        } else {
            const addrs = await dns.lookup(host);
            console.log('Address found:', addrs);
        }
    } catch (err) {
        console.error('DNS Resolution failed:', err.message);
    }
}

async function testConnection() {
    console.log('\n--- Mongoose Connection Test ---');
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log('✓ Successfully connected to MongoDB');
        await mongoose.disconnect();
    } catch (err) {
        console.error('✗ Connection failed:', err.message);
        if (err.reason) {
            console.log('Reason Topology:', err.reason.servers);
        }
    }
}

async function run() {
    await testDNS();
    await testConnection();
}

run();
