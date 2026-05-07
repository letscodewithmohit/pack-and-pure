import dotenv from "dotenv";
import connectDB from "../app/dbConfig/dbConfig.js";
import Delivery from "../app/models/delivery.js";
import Order from "../app/models/order.js";
import Transaction from "../app/models/transaction.js";

dotenv.config();

async function run() {
  await connectDB();
  const riders = await Delivery.find().lean();
  console.log(`[check-riders] Found ${riders.length} riders:`);
  for (const r of riders) {
    console.log(`- Rider Name: ${r.name}, Phone: ${r.phone}, ID: ${r._id}`);
  }

  const transactions = await Transaction.find({ userModel: "Delivery" }).lean();
  console.log(`\n[check-riders] Found ${transactions.length} Delivery Transactions:`);
  for (const t of transactions) {
    console.log(`- ID: ${t._id}, Amount: ${t.amount}, Type: ${t.type}, User: ${t.user}`);
  }

  const orders = await Order.find({ deliveryBoy: { $ne: null } }).lean();
  console.log(`\n[check-riders] Found ${orders.length} orders with delivery boys.`);
  for (const o of orders) {
    console.log(`- ID: ${o.orderId}, Status: ${o.status}, DB: ${o.deliveryBoy}`);
  }

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
