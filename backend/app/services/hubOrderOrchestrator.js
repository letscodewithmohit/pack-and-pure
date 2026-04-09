import HubInventory from "../models/hubInventory.js";
import Product from "../models/product.js";
import PurchaseRequest from "../models/purchaseRequest.js";

const HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";

const buildRequestId = () =>
  `PR-${Date.now()}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;

export const HUB_ORDER_MODE = () =>
  String(process.env.HUB_FIRST_ORDER_ROUTING || "false").toLowerCase() === "true";

/**
 * Build stock snapshot and shortages for an order's items.
 */
export const planHubFulfillment = async (orderItems, hubId = HUB_ID) => {
  const productIds = orderItems.map((item) => String(item.product));
  const [inventoryRows, products] = await Promise.all([
    HubInventory.find({ hubId, productId: { $in: productIds } }).lean(),
    Product.find({ _id: { $in: productIds } }).select("_id sellerId").lean(),
  ]);

  const invMap = new Map(
    inventoryRows.map((row) => [String(row.productId), Number(row.availableQty || 0)]),
  );
  const sellerMap = new Map(
    products.map((p) => [String(p._id), p?.sellerId ? String(p.sellerId) : null]),
  );

  const shortages = [];
  const allocations = [];

  for (const item of orderItems) {
    const productId = String(item.product);
    const requiredQty = Number(item.quantity || 0);
    const availableQty = Math.max(0, Number(invMap.get(productId) || 0));
    const reserveQty = Math.min(availableQty, requiredQty);
    const shortageQty = Math.max(0, requiredQty - reserveQty);
    allocations.push({ productId, reserveQty });
    if (shortageQty > 0) {
      shortages.push({
        productId,
        requiredQty,
        availableQtyAtHub: availableQty,
        shortageQty,
        vendorId: sellerMap.get(productId) || null,
      });
    }
  }

  return {
    hubId,
    allocations,
    shortages,
    fullyAvailable: shortages.length === 0,
  };
};

/**
 * Reserve inventory rows for fully-available orders.
 * Returns false if any reserve check fails (race-safe).
 */
export const reserveHubInventory = async (allocations, hubId = HUB_ID) => {
  const reservedRows = [];
  for (const row of allocations) {
    if (!row.reserveQty || row.reserveQty <= 0) continue;
    const updated = await HubInventory.findOneAndUpdate(
      {
        hubId,
        productId: row.productId,
        availableQty: { $gte: row.reserveQty },
      },
      {
        $inc: {
          availableQty: -row.reserveQty,
          reservedQty: row.reserveQty,
        },
      },
      { new: true },
    );
    if (!updated) {
      // Roll back partial reservations when any line fails (race-safe best effort).
      for (const applied of reservedRows) {
        await HubInventory.findOneAndUpdate(
          { hubId, productId: applied.productId },
          {
            $inc: {
              availableQty: applied.reserveQty,
              reservedQty: -applied.reserveQty,
            },
          },
        );
      }
      return false;
    }
    reservedRows.push({ productId: row.productId, reserveQty: row.reserveQty });
  }
  return true;
};

/**
 * Create procurement requests grouped by vendor for shortage items.
 */
export const createAutoPurchaseRequests = async ({ order, shortages, hubId = HUB_ID }) => {
  const shortageProductIds = shortages
    .map((item) => String(item.productId || ""))
    .filter(Boolean);

  const fallbackProducts = shortageProductIds.length
    ? await Product.find({ _id: { $in: shortageProductIds } })
        .select("_id sellerId")
        .lean()
    : [];
  const fallbackSellerMap = new Map(
    fallbackProducts.map((p) => [String(p._id), p?.sellerId ? String(p.sellerId) : null]),
  );

  const enrichedShortages = shortages.map((item) => {
    if (item.vendorId) return item;
    return {
      ...item,
      vendorId: fallbackSellerMap.get(String(item.productId)) || null,
    };
  });

  const grouped = new Map();
  for (const item of enrichedShortages) {
    const groupKey = item.vendorId || "UNASSIGNED";
    if (!grouped.has(groupKey)) grouped.set(groupKey, []);
    grouped.get(groupKey).push(item);
  }

  const docs = [];
  for (const [vendorKey, items] of grouped.entries()) {
    const vendorId = vendorKey === "UNASSIGNED" ? null : vendorKey;
    docs.push({
      requestId: buildRequestId(),
      orderId: order._id,
      hubId,
      vendorId,
      status: "created",
      items: items.map((i) => ({
        productId: i.productId,
        requiredQty: i.requiredQty,
        availableQtyAtHub: i.availableQtyAtHub,
        shortageQty: i.shortageQty,
      })),
      notes:
        vendorId === null
          ? `Auto-generated from order ${order.orderId} (vendor assignment required)`
          : `Auto-generated from order ${order.orderId}`,
    });
  }

  if (!docs.length) return [];
  return PurchaseRequest.insertMany(docs);
};
