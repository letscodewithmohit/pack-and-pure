import dotenv from "dotenv";
import connectDB from "../app/dbConfig/dbConfig.js";
import Delivery from "../app/models/delivery.js";

dotenv.config();

async function run() {
  await connectDB();
  const skip = 0;
  const limit = 25;
  const ridersPipeline = [
    { $lookup: { from: "transactions", localField: "_id", foreignField: "user", as: "allTransactions" } },
    { $lookup: { from: "orders", localField: "_id", foreignField: "deliveryBoy", as: "allOrders" } },
    {
      $project: {
        name: 1, phone: 1, avatar: 1, limit: { $ifNull: ["$limit", 5000] }, documents: 1,
        currentCash: { $reduce: { input: { $filter: { input: "$allTransactions", as: "t", cond: { $in: ["$$t.type", ["Cash Collection", "Cash Settlement"]] } } }, initialValue: 0, in: { $cond: [{ $eq: ["$$this.type", "Cash Collection"] }, { $add: ["$$value", "$$this.amount"] }, { $subtract: ["$$value", { $abs: "$$this.amount" }] }] } } },
        pendingOrders: { $size: { $filter: { input: "$allOrders", as: "o", cond: { $and: [{ $in: ["$$o.status", ["confirmed", "packed", "picked_up", "out_for_delivery"]] }, { $in: ["$$o.payment.method", ["cash", "cod"]] }] } } } },
        totalOrders: { $size: { $filter: { input: "$allOrders", as: "o", cond: { $eq: ["$$o.status", "delivered"] } } } },
        lastSettlementTxn: { $arrayElemAt: [{ $sortArray: { input: { $filter: { input: "$allTransactions", as: "t", cond: { $eq: ["$$t.type", "Cash Settlement"] } } }, sortBy: { createdAt: -1 } } }, 0] },
      }
    },
    {
      $project: {
        id: "$_id", name: 1, phone: 1, currentCash: 1, limit: 1, pendingOrders: 1, totalOrders: 1,
        avatar: { $cond: [{ $ifNull: ["$documents.profileImage", false] }, "$documents.profileImage", { $concat: ["https://api.dicebear.com/7.x/avataaars/svg?seed=", "$name"] }] },
        status: { $cond: [{ $gt: ["$currentCash", 4500] }, "critical", { $cond: [{ $gt: ["$currentCash", 3000] }, "warning", "safe"] }] },
        lastSettlement: { $ifNull: ["$lastSettlementTxn.createdAt", "Never"] },
      }
    },
    { $facet: { meta: [{ $count: "total" }], items: [{ $skip: skip }, { $limit: limit }] } }
  ];

  const result = await Delivery.aggregate(ridersPipeline);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
