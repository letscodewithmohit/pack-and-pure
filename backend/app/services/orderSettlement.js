import Transaction from "../models/transaction.js";

/**
 * Financial side effects when order becomes delivered (mirrors orderController).
 */
export async function applyDeliveredSettlement(order, orderIdString) {
  await Transaction.findOneAndUpdate(
    { reference: orderIdString, userModel: "Seller" },
    { status: "Settled" },
  );

  if (order.deliveryBoy) {
    const deliveryEarning = Math.round((order.pricing?.total || 0) * 0.1);
    await Transaction.create({
      user: order.deliveryBoy,
      userModel: "Delivery",
      order: order._id,
      type: "Delivery Earning",
      amount: deliveryEarning,
      status: "Settled",
      reference: `DEL-ERN-${orderIdString}`,
    });

    const method = (order.payment?.method || "").toLowerCase();
    if (method === "cash" || method === "cod") {
      await Transaction.create({
        user: order.deliveryBoy,
        userModel: "Delivery",
        order: order._id,
        type: "Cash Collection",
        amount: order.pricing.total,
        status: "Settled",
        reference: `CASH-COL-${orderIdString}`,
      });
    }
  }
}
