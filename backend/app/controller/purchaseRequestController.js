import mongoose from "mongoose";
import PurchaseRequest from "../models/purchaseRequest.js";
import HubInward from "../models/hubInward.js";
import HubInventory from "../models/hubInventory.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import Seller from "../models/seller.js";
import PickupPartner from "../models/pickupPartner.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";

const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";

const ALLOWED_STATUSES = new Set([
  "created",
  "vendor_confirmed",
  "pickup_assigned",
  "picked",
  "received_at_hub",
  "verified",
  "closed",
  "cancelled",
]);

const PR_DONE_STATUSES = new Set(["verified", "closed", "cancelled"]);

const mapRow = (reqDoc) => {
  const item = Array.isArray(reqDoc.items) ? reqDoc.items[0] : null;
  return {
    _id: reqDoc._id,
    requestId: reqDoc.requestId,
    orderId: reqDoc.orderId,
    vendorId: reqDoc.vendorId?._id || reqDoc.vendorId || null,
    vendorName:
      reqDoc.vendorId?.shopName ||
      reqDoc.vendorId?.name ||
      reqDoc.vendorName ||
      "Unassigned Vendor",
    productId: item?.productId?._id || item?.productId || null,
    product:
      item?.productId?.name ||
      reqDoc.product ||
      (Array.isArray(reqDoc.items) && reqDoc.items.length > 1
        ? `${reqDoc.items.length} items`
        : "Product"),
    quantity: Number(item?.shortageQty || item?.requiredQty || reqDoc.quantity || 0),
    status: reqDoc.status,
    pickupPartnerId: reqDoc.pickupPartnerId || null,
    pickupPartnerName: reqDoc.pickupPartnerName || "",
    notes: reqDoc.notes || "",
    eta: reqDoc.eta || null,
    createdAt: reqDoc.createdAt,
    updatedAt: reqDoc.updatedAt,
  };
};

export const getPurchaseRequests = async (req, res) => {
  try {
    const { status, orderId, requestId, hubId = DEFAULT_HUB_ID } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const query = { hubId: String(hubId) };
    if (status && status !== "all") query.status = status;
    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) query.orderId = orderId;
    if (requestId) query.requestId = { $regex: String(requestId), $options: "i" };

    const [items, total] = await Promise.all([
      PurchaseRequest.find(query)
        .populate("vendorId", "shopName name")
        .populate("items.productId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseRequest.countDocuments(query),
    ]);

    return handleResponse(res, 200, "Purchase requests fetched", {
      items: items.map(mapRow),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updatePurchaseRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, eta } = req.body || {};

    if (!ALLOWED_STATUSES.has(String(status || ""))) {
      return handleResponse(res, 400, "Invalid status");
    }

    const doc = await PurchaseRequest.findById(id);
    if (!doc) return handleResponse(res, 404, "Purchase request not found");

    doc.status = status;
    if (notes !== undefined) doc.notes = String(notes || "");
    if (eta) doc.eta = new Date(eta);
    await doc.save();

    return handleResponse(res, 200, "Purchase request status updated", doc);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const assignPickupPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { pickupPartnerId, pickupPartnerName } = req.body || {};

    const doc = await PurchaseRequest.findById(id);
    if (!doc) return handleResponse(res, 404, "Purchase request not found");

    if (pickupPartnerId) {
      const partner = await PickupPartner.findById(pickupPartnerId).lean();
      if (!partner) return handleResponse(res, 404, "Pickup partner not found");
      doc.pickupPartnerId = partner._id;
      doc.pickupPartnerName = String(partner.name || "").trim();
      await PickupPartner.findByIdAndUpdate(partner._id, {
        $set: { status: "active", isActive: true },
      });
    } else {
      doc.pickupPartnerId = null;
      doc.pickupPartnerName = String(pickupPartnerName || "").trim();
    }
    doc.status = "pickup_assigned";
    await doc.save();

    return handleResponse(res, 200, "Pickup partner assigned", doc);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const assignVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body || {};
    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return handleResponse(res, 400, "Valid vendorId is required");
    }

    const [doc, vendor] = await Promise.all([
      PurchaseRequest.findById(id),
      Seller.findById(vendorId).select("_id shopName name"),
    ]);
    if (!doc) return handleResponse(res, 404, "Purchase request not found");
    if (!vendor) return handleResponse(res, 404, "Vendor not found");

    doc.vendorId = vendor._id;
    if (doc.status === "cancelled") {
      doc.status = "created";
    }
    await doc.save();

    return handleResponse(res, 200, "Vendor assigned successfully", doc);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const receiveAtHub = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, notes } = req.body || {};

    const pr = await PurchaseRequest.findById(id).populate("items.productId", "name");
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    const incomingItems = Array.isArray(items) ? items : [];
    const normalized = [];

    for (const line of pr.items || []) {
      const productId = String(line.productId?._id || line.productId);
      const incoming =
        incomingItems.find((it) => String(it.productId) === productId) || {};
      const expectedQty = Number(line.shortageQty || line.requiredQty || 0);
      const receivedQty = Math.max(
        0,
        Number(incoming.receivedQty ?? expectedQty ?? 0),
      );
      const damagedQty = Math.max(0, Number(incoming.damagedQty || 0));
      const acceptedQty = Math.max(0, receivedQty - damagedQty);

      const hubRow = await HubInventory.findOne({
        hubId: pr.hubId || DEFAULT_HUB_ID,
        productId,
      });

      if (hubRow) {
        hubRow.availableQty = Math.max(0, Number(hubRow.availableQty || 0) + acceptedQty);
        if (hubRow.availableQty <= 0) hubRow.status = "out_of_stock";
        else if (hubRow.availableQty <= Number(hubRow.reorderLevel || 0))
          hubRow.status = "low_stock";
        else hubRow.status = "healthy";
        await hubRow.save();
      } else {
        await HubInventory.create({
          hubId: pr.hubId || DEFAULT_HUB_ID,
          productId,
          availableQty: acceptedQty,
          reorderLevel: 10,
          status: acceptedQty > 0 ? "healthy" : "out_of_stock",
        });
      }

      normalized.push({
        productId,
        expectedQty,
        receivedQty,
        damagedQty,
        qualityStatus: incoming.qualityStatus || "ok",
      });
    }

    await HubInward.create({
      purchaseRequestId: pr._id,
      hubId: pr.hubId || DEFAULT_HUB_ID,
      receivedItems: normalized,
      verificationStatus: "pending",
      receivedBy: req.user?.id || null,
      receivedByModel: "Admin",
      notes: String(notes || ""),
    });

    pr.status = "received_at_hub";
    await pr.save();

    if (pr.pickupPartnerId) {
      const openCount = await PurchaseRequest.countDocuments({
        pickupPartnerId: pr.pickupPartnerId,
        status: { $in: ["pickup_assigned", "picked"] },
      });
      if (openCount === 0) {
        await PickupPartner.findByIdAndUpdate(pr.pickupPartnerId, {
          $set: { status: "available" },
        });
      }
    }

    return handleResponse(res, 200, "Items received at hub", { purchaseRequestId: pr._id });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const verifyInward = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified = true, notes } = req.body || {};

    const pr = await PurchaseRequest.findById(id);
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    const inward = await HubInward.findOne({ purchaseRequestId: pr._id }).sort({
      createdAt: -1,
    });
    if (!inward) {
      return handleResponse(res, 404, "No hub inward record found");
    }

    inward.verificationStatus = verified ? "verified" : "rejected";
    inward.verifiedBy = req.user?.id || null;
    inward.verifiedByModel = "Admin";
    inward.verificationNotes = String(notes || "");
    await inward.save();

    pr.status = verified ? "verified" : "cancelled";
    if (notes !== undefined) pr.notes = String(notes || "");
    await pr.save();

    // If all purchase requests for this order are resolved, move order to packing-ready stage.
    const [parentOrder, siblingRequests] = await Promise.all([
      Order.findById(pr.orderId),
      PurchaseRequest.find({ orderId: pr.orderId }).select("status").lean(),
    ]);
    if (parentOrder) {
      const allDone =
        siblingRequests.length > 0 &&
        siblingRequests.every((row) => PR_DONE_STATUSES.has(String(row.status)));
      if (allDone) {
        parentOrder.hubStatus = "ready_for_packing";
        parentOrder.procurementRequired = false;
        if (parentOrder.workflowVersion >= 2) {
          parentOrder.workflowStatus = WORKFLOW_STATUS.SELLER_ACCEPTED;
        }
        if (parentOrder.status === "pending") {
          parentOrder.status = "confirmed";
        }
        await parentOrder.save();
      }
    }

    return handleResponse(res, 200, "Hub inward verification updated", {
      purchaseRequestId: pr._id,
      status: pr.status,
      verificationStatus: inward.verificationStatus,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
