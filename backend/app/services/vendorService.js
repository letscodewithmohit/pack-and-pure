import PurchaseRequest from "../models/purchaseRequest.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";

/**
 * Service to manage vendor-specific logic.
 * Requirements: vendorOrders collection (mapped to PurchaseRequest), status management.
 */

export const getVendorOrders = async (vendorId, filters = {}) => {
  const query = { vendorId, ...filters };
  return await PurchaseRequest.find(query).sort({ createdAt: -1 });
};

export const acceptVendorOrder = async (purchaseRequestId, vendorId) => {
  const doc = await PurchaseRequest.findOneAndUpdate(
    { _id: purchaseRequestId, vendorId, status: "created" },
    { $set: { status: "vendor_confirmed", acknowledgedAt: new Date() } },
    { new: true }
  );
  if (!doc) throw new Error("Order not available for acceptance");
  return doc;
};

export const markVendorOrderReady = async (purchaseRequestId, vendorId) => {
  // Logic already exists in purchaseRequestController, but we can wrap it here
  // or export from here once we refactor.
  return { purchaseRequestId, vendorId, status: "ready" }; 
};

export const getVendorStats = async (vendorId) => {
  const stats = await PurchaseRequest.aggregate([
    { $match: { vendorId: vendorId } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  return stats;
};
