import mongoose from "mongoose";
import crypto from "crypto";
import PurchaseRequest from "../models/purchaseRequest.js";
import HubInward from "../models/hubInward.js";
import HubInventory from "../models/hubInventory.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import Seller from "../models/seller.js";
import PickupPartner from "../models/pickupPartner.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { startHubDeliverySearchAtomic } from "../services/orderWorkflowService.js";
import Transaction from "../models/transaction.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";

const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";

const ALLOWED_STATUSES = new Set([
  "created",
  "vendor_confirmed",
  "pickup_assigned",
  "picked",
  "hub_delivered",
  "received_at_hub",
  "verified",
  "closed",
  "cancelled",
  "exception",
]);

const PR_DONE_STATUSES = new Set(["verified", "closed", "cancelled"]);

const PICKUP_OTP_EXPIRY_MINUTES = Math.max(
  1,
  Number(process.env.PICKUP_OTP_EXPIRY_MINUTES || 30),
);
const PICKUP_OTP_MOCK_MODE =
  String(process.env.PICKUP_OTP_MOCK_MODE || "").toLowerCase() === "true";
const PICKUP_OTP_MOCK_VALUE = String(process.env.PICKUP_OTP_MOCK_VALUE || "1234");
const DEFAULT_MARGIN_TYPE = String(
  process.env.DEFAULT_PROCUREMENT_MARGIN_TYPE || "percent",
).toLowerCase() === "flat"
  ? "flat"
  : "percent";
const DEFAULT_MARGIN_VALUE = Math.max(
  0,
  Number(process.env.DEFAULT_PROCUREMENT_MARGIN_VALUE || 15),
);
const toMoney = (value) => Math.max(0, Number(Number(value || 0).toFixed(2)));
const resolveMarginType = (value) =>
  String(value || "").toLowerCase() === "flat" ? "flat" : "percent";
const resolveMarginValue = (value) => Math.max(0, Number(value || 0));
const computeSellPrice = (cost, marginType, marginValue) => {
  const base = Math.max(0, Number(cost || 0));
  if (resolveMarginType(marginType) === "flat") {
    return toMoney(base + resolveMarginValue(marginValue));
  }
  return toMoney(base + (base * resolveMarginValue(marginValue)) / 100);
};

const hashPickupOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

const generatePickupOtp = () => {
  if (PICKUP_OTP_MOCK_MODE) return PICKUP_OTP_MOCK_VALUE;
  return String(Math.floor(1000 + Math.random() * 9000));
};

const generateRequestId = () =>
  `PR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

const pickBestPickupPartner = async (hubId = DEFAULT_HUB_ID) => {
  const candidates = await PickupPartner.find({
    hubId: String(hubId || DEFAULT_HUB_ID),
    isActive: true,
    isVerified: true,
    status: { $in: ["available", "active"] },
  })
    .select("_id name status")
    .lean();

  if (!candidates.length) return null;

  const ids = candidates.map((c) => c._id);
  const activeCounts = await PurchaseRequest.aggregate([
    {
      $match: {
        pickupPartnerId: { $in: ids },
        status: { $in: ["pickup_assigned", "picked"] },
      },
    },
    {
      $group: {
        _id: "$pickupPartnerId",
        count: { $sum: 1 },
      },
    },
  ]);
  const countMap = new Map(
    activeCounts.map((r) => [String(r._id), Number(r.count || 0)]),
  );

  const sorted = [...candidates].sort((a, b) => {
    const ac = countMap.get(String(a._id)) || 0;
    const bc = countMap.get(String(b._id)) || 0;
    if (ac !== bc) return ac - bc;
    if (a.status === "available" && b.status !== "available") return -1;
    if (b.status === "available" && a.status !== "available") return 1;
    return 0;
  });

  return sorted[0] || null;
};

const assignPickupToRequest = async (doc, partner) => {
  doc.pickupPartnerId = partner._id;
  doc.pickupPartnerName = String(partner.name || "").trim();
  const otp = generatePickupOtp();
  doc.pickupOtpCode = otp;
  doc.pickupOtpHash = hashPickupOtp(otp);
  doc.pickupOtpExpiresAt = new Date(
    Date.now() + PICKUP_OTP_EXPIRY_MINUTES * 60 * 1000,
  );
  doc.pickupOtpVerifiedAt = undefined;
  doc.pickupProof = undefined;
  doc.hubDropProof = undefined;
  doc.exceptionReason = "";
  doc.status = "pickup_assigned";
  await doc.save();
  await PickupPartner.findByIdAndUpdate(partner._id, {
    $set: { status: "active", isActive: true },
  });

  // Notify pickup partner about new assignment
  try {
    const { createNotification } = await import("../services/notificationService.js");
    await createNotification({
      recipient: partner._id,
      recipientModel: "PickupPartner",
      title: "New Pickup Task",
      message: `You have been assigned a new pickup task from ${doc.vendorName || "a vendor"}.`,
      type: "order",
      data: { 
        requestId: doc.requestId, 
        purchaseRequestId: doc._id.toString(),
        orderId: doc.orderId?.toString()
      },
    });
  } catch (error) {
    console.warn("[assignPickupToRequest] Notification failed:", error.message);
  }

  return otp;
};

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
    unitCost: Number(item?.vendorUnitCost || 0),
    status: reqDoc.status,
    pickupPartnerId: reqDoc.pickupPartnerId || null,
    pickupPartnerName: reqDoc.pickupPartnerName || "",
    notes: reqDoc.notes || "",
    exceptionReason: reqDoc.exceptionReason || "",
    eta: reqDoc.eta || null,
    createdAt: reqDoc.createdAt,
    updatedAt: reqDoc.updatedAt,
  };
};

const mapSellerRow = (reqDoc) => ({
  _id: reqDoc._id,
  requestId: reqDoc.requestId,
  orderId: reqDoc.orderId?._id || reqDoc.orderId || null,
  orderCode: reqDoc.orderId?.orderId || "",
  hubId: reqDoc.hubId,
  status: reqDoc.status,
  vendorResponse: reqDoc.vendorResponse || { status: "pending" },
  vendorReadyAt: reqDoc.vendorReadyAt || null,
  vendorReadyNotes: reqDoc.vendorReadyNotes || "",
  pickupPartner: reqDoc.pickupPartnerId
    ? {
        id: reqDoc.pickupPartnerId?._id || reqDoc.pickupPartnerId,
        name:
          reqDoc.pickupPartnerId?.name ||
          reqDoc.pickupPartnerName ||
          "Pickup Partner",
        phone: reqDoc.pickupPartnerId?.phone || "",
      }
    : null,
  pickupAssigned: Boolean(reqDoc.pickupPartnerId),
  pickupOtp:
    String(reqDoc.status) === "pickup_assigned" &&
    (!reqDoc.pickupOtpExpiresAt || new Date(reqDoc.pickupOtpExpiresAt) > new Date())
      ? String(reqDoc.pickupOtpCode || "")
      : "",
  pickupOtpExpiresAt: reqDoc.pickupOtpExpiresAt || null,
  items: (reqDoc.items || []).map((item) => ({
    productId: item.productId?._id || item.productId || null,
    productName: item.productId?.name || "Product",
    requiredQty: Number(item.requiredQty || 0),
    shortageQty: Number(item.shortageQty || 0),
    committedQty: Number(item.committedQty || 0),
    unitCost: Number(item.vendorUnitCost || 0),
  })),
  notes: reqDoc.notes || "",
  exceptionReason: reqDoc.exceptionReason || "",
  createdAt: reqDoc.createdAt,
  updatedAt: reqDoc.updatedAt,
});

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

export const createManualPurchaseRequest = async (req, res) => {
  try {
    const {
      vendorId,
      productId,
      quantity,
      hubId = DEFAULT_HUB_ID,
      notes,
    } = req.body || {};

    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return handleResponse(res, 400, "Valid vendorId is required");
    }
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return handleResponse(res, 400, "Valid productId is required");
    }

    const qty = Math.max(1, Number(quantity || 0));
    if (!Number.isFinite(qty) || qty <= 0) {
      return handleResponse(res, 400, "Valid quantity is required");
    }

    const [vendor, product] = await Promise.all([
      Seller.findById(vendorId).select("_id shopName name"),
      Product.findById(productId).select("_id name status price salePrice"),
    ]);

    if (!vendor) return handleResponse(res, 404, "Vendor not found");
    if (!product) return handleResponse(res, 404, "Product not found");

    let requestId = generateRequestId();
    let retries = 0;
    while (retries < 10) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await PurchaseRequest.exists({ requestId });
      if (!exists) break;
      requestId = generateRequestId();
      retries += 1;
    }

    const unitCost = toMoney(
      Number(product?.salePrice || 0) > 0 &&
        Number(product?.salePrice || 0) < Number(product?.price || 0)
        ? product.salePrice
        : product.price,
    );

    const doc = await PurchaseRequest.create({
      requestId,
      orderId: null,
      hubId: String(hubId || DEFAULT_HUB_ID),
      vendorId: vendor._id,
      items: [
        {
          productId: product._id,
          requiredQty: qty,
          availableQtyAtHub: 0,
          shortageQty: qty,
          vendorUnitCost: unitCost,
          vendorQuotedPrice: unitCost,
          pricingStrategy: "manual_admin_request",
        },
      ],
      status: "created",
      notes: String(notes || ""),
    });

    const hydrated = await PurchaseRequest.findById(doc._id)
      .populate("vendorId", "shopName name")
      .populate("items.productId", "name")
      .lean();

    return handleResponse(
      res,
      201,
      "Purchase request created successfully",
      mapRow(hydrated),
    );
  } catch (error) {
    if (error?.code === 11000) {
      return handleResponse(res, 400, "Duplicate purchase request id, retry");
    }
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
      const otp = await assignPickupToRequest(doc, partner);
      return handleResponse(res, 200, "Pickup partner assigned", {
        ...doc.toObject(),
        pickupOtp: otp,
        pickupOtpExpiresAt: doc.pickupOtpExpiresAt,
      });
    } else {
      doc.pickupPartnerId = null;
      doc.pickupPartnerName = String(pickupPartnerName || "").trim();
      doc.pickupOtpCode = undefined;
      doc.pickupOtpHash = undefined;
      doc.pickupOtpExpiresAt = undefined;
      doc.pickupOtpVerifiedAt = undefined;
      doc.status = "vendor_confirmed";
      await doc.save();
      return handleResponse(res, 200, "Pickup partner assignment cleared", doc);
    }
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
    if (!["picked", "hub_delivered", "pickup_assigned"].includes(String(pr.status))) {
      return handleResponse(
        res,
        400,
        "Request must be picked/hub_delivered before receiving at hub",
      );
    }

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
      const fallbackCost = toMoney(Number(line.vendorUnitCost || 0));
      const incomingCost = toMoney(
        incoming.purchaseUnitCost !== undefined ? incoming.purchaseUnitCost : fallbackCost,
      );

      const hubRow = await HubInventory.findOne({
        hubId: pr.hubId || DEFAULT_HUB_ID,
        productId,
      });

      if (hubRow) {
        const prevQty = Math.max(0, Number(hubRow.availableQty || 0));
        const prevAvgCost = Math.max(0, Number(hubRow.avgPurchaseCost || hubRow.lastPurchaseCost || 0));
        const nextQty = prevQty + acceptedQty;
        const weightedAvgCost =
          nextQty > 0 ? toMoney((prevAvgCost * prevQty + incomingCost * acceptedQty) / nextQty) : 0;
        const marginType = resolveMarginType(hubRow.marginType || DEFAULT_MARGIN_TYPE);
        const marginValue = resolveMarginValue(
          hubRow.marginValue !== undefined ? hubRow.marginValue : DEFAULT_MARGIN_VALUE,
        );
        const sellPrice = computeSellPrice(weightedAvgCost || incomingCost, marginType, marginValue);

        hubRow.reservedQty = Math.max(0, Number(hubRow.reservedQty || 0) + acceptedQty);
        hubRow.lastPurchaseCost = incomingCost;
        hubRow.avgPurchaseCost = weightedAvgCost;
        hubRow.marginType = marginType;
        hubRow.marginValue = marginValue;
        hubRow.sellPrice = sellPrice;
        hubRow.priceUpdatedAt = new Date();
        if (hubRow.availableQty <= 0) hubRow.status = "out_of_stock";
        else if (hubRow.availableQty <= Number(hubRow.reorderLevel || 0))
          hubRow.status = "low_stock";
        else hubRow.status = "healthy";
        await hubRow.save();
      } else {
        const marginType = resolveMarginType(DEFAULT_MARGIN_TYPE);
        const marginValue = resolveMarginValue(DEFAULT_MARGIN_VALUE);
        const sellPrice = computeSellPrice(incomingCost, marginType, marginValue);
        await HubInventory.create({
          hubId: pr.hubId || DEFAULT_HUB_ID,
          productId,
          availableQty: 0,
          reservedQty: acceptedQty,
          reorderLevel: 10,
          lastPurchaseCost: incomingCost,
          avgPurchaseCost: incomingCost,
          marginType,
          marginValue,
          sellPrice,
          priceUpdatedAt: new Date(),
          status: acceptedQty > 0 ? "healthy" : "out_of_stock",
        });
      }

      normalized.push({
        productId,
        expectedQty,
        receivedQty,
        damagedQty,
        purchaseUnitCost: incomingCost,
        acceptedQty,
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

    // Financial Settlement: If verified, credit the Seller for the procurement cost
    if (verified && pr.vendorId) {
      let totalProcurementCost = 0;
      if (inward.receivedItems && inward.receivedItems.length > 0) {
        totalProcurementCost = inward.receivedItems.reduce((acc, item) => {
          return acc + (Number(item.acceptedQty || 0) * Number(item.purchaseUnitCost || 0));
        }, 0);
      }

      if (totalProcurementCost > 0) {
        await Transaction.create({
          user: pr.vendorId,
          userModel: "Seller",
          order: pr.orderId || undefined,
          type: "Supply Earning",
          amount: totalProcurementCost,
          status: "Settled",
          reference: `PR-SETTLE-${pr.requestId}`,
          meta: {
            purchaseRequestId: pr._id,
            verifiedAt: new Date(),
          }
        });
        console.log(`[Settlement] Created Supply Earning for Seller ${pr.vendorId}: ₹${totalProcurementCost}`);
      }
    }

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
        if (verified && parentOrder.workflowVersion >= 2 && parentOrder.hubFlowEnabled) {
          try {
            await startHubDeliverySearchAtomic(parentOrder.orderId);
          } catch (e) {
            console.warn(
              `[verifyInward] auto dispatch skipped for ${parentOrder.orderId}:`,
              e.message,
            );
          }
        }
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

export const getSellerPurchaseRequests = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    const { status = "all" } = req.query || {};

    const query = { vendorId: sellerId };
    if (status !== "all") {
      query.status = String(status);
    }

    // We fetch and then filter to ensure we only show requests with VALID existing orders
    const rows = await PurchaseRequest.find(query)
      .populate({
        path: "orderId",
        select: "orderId status workflowStatus",
      })
      .populate("items.productId", "name")
      .populate("pickupPartnerId", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    // Filter out requests where order is missing or cancelled at the order level
    const filteredRows = rows.filter(row => {
      // If it's a manual admin PR (no orderId), show it
      if (!row.orderId && !row.requestId.includes("ORD")) return true;
      
      // If order is missing from DB or order status is cancelled, hide it from seller
      if (!row.orderId || row.orderId.status === "cancelled") return false;
      
      return true;
    });

    return handleResponse(res, 200, "Seller purchase requests fetched", {
      items: filteredRows.map(mapSellerRow),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const respondSellerPurchaseRequest = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    const { id } = req.params;
    const {
      action = "accept",
      notes = "",
      rejectionReason = "",
      items = [],
    } = req.body || {};

    const pr = await PurchaseRequest.findOne({ _id: id, vendorId: sellerId }).populate(
      "items.productId",
      "name",
    );
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    if (!["created", "vendor_confirmed", "pickup_assigned"].includes(String(pr.status))) {
      return handleResponse(
        res,
        400,
        "Purchase request is not open for seller response",
      );
    }

    const normalizedAction = String(action).toLowerCase();
    if (!["accept", "reject", "partial"].includes(normalizedAction)) {
      return handleResponse(res, 400, "Invalid action");
    }

    if (normalizedAction === "reject") {
      pr.vendorResponse = {
        status: "rejected",
        respondedAt: new Date(),
        rejectionReason: String(rejectionReason || "Rejected by seller"),
        notes: String(notes || ""),
      };
      pr.status = "exception";
      pr.exceptionReason = String(rejectionReason || "Rejected by seller");
      await pr.save();
      return handleResponse(res, 200, "Purchase request rejected", mapSellerRow(pr.toObject()));
    }

    const incomingMap = new Map(
      (Array.isArray(items) ? items : [])
        .filter((row) => row && row.productId != null)
        .map((row) => [String(row.productId), Number(row.committedQty || 0)]),
    );

    let fullyCommitted = true;
    let anyCommitted = false;
    pr.items = (pr.items || []).map((line) => {
      const shortage = Number(line.shortageQty || 0);
      let committedQty = shortage;
      const key = String(line.productId?._id || line.productId);
      if (incomingMap.has(key)) {
        committedQty = Math.min(shortage, Math.max(0, incomingMap.get(key)));
      } else if (normalizedAction === "partial") {
        committedQty = Number(line.committedQty || 0);
      }
      if (committedQty < shortage) fullyCommitted = false;
      if (committedQty > 0) anyCommitted = true;
      return { ...line.toObject(), committedQty };
    });

    const responseStatus = fullyCommitted
      ? "accepted"
      : anyCommitted
        ? "partial"
        : "rejected";

    pr.vendorResponse = {
      status: responseStatus,
      respondedAt: new Date(),
      rejectionReason: responseStatus === "rejected" ? "No quantity committed" : "",
      notes: String(notes || ""),
    };
    pr.status = "vendor_confirmed";
    pr.exceptionReason = "";
    await pr.save();

    return handleResponse(res, 200, "Seller response saved", mapSellerRow(pr.toObject()));
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const markSellerRequestReady = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    const { id } = req.params;
    const { notes = "" } = req.body || {};

    const pr = await PurchaseRequest.findOne({ _id: id, vendorId: sellerId }).lean();
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    if (!["created", "vendor_confirmed", "pickup_assigned"].includes(String(pr.status))) {
      return handleResponse(
        res,
        400,
        "Request must be created/vendor_confirmed before marking ready",
      );
    }

    const doc = await PurchaseRequest.findById(id);
    if (!doc) return handleResponse(res, 404, "Purchase request not found");

    doc.vendorReadyAt = new Date();
    doc.vendorReadyNotes = String(notes || "");
    if (String(doc.vendorResponse?.status || "pending") === "pending") {
      doc.vendorResponse = {
        status: "accepted",
        respondedAt: new Date(),
        rejectionReason: "",
        notes: String(notes || ""),
      };
      if (String(doc.status) === "created") {
        doc.status = "vendor_confirmed";
      }
    }
    let autoAssigned = false;

    if (!doc.pickupPartnerId) {
      const partner = await pickBestPickupPartner(doc.hubId || DEFAULT_HUB_ID);
      if (partner) {
        await assignPickupToRequest(doc, partner);
        autoAssigned = true;
      } else {
        doc.status = "vendor_confirmed";
        await doc.save();
      }
    } else {
      await doc.save();
    }

    const updated = await PurchaseRequest.findById(id)
      .populate("orderId", "orderId")
      .populate("items.productId", "name")
      .populate("pickupPartnerId", "name phone")
      .lean();

    return handleResponse(res, 200, "Marked ready for pickup", {
      ...mapSellerRow(updated),
      autoPickupAssigned: autoAssigned,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const confirmSellerHandover = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    const { id } = req.params;
    const { otp, notes = "" } = req.body || {};

    if (!otp) return handleResponse(res, 400, "Pickup OTP is required");

    const pr = await PurchaseRequest.findOne({ _id: id, vendorId: sellerId }).populate(
      "items.productId",
      "name",
    );
    if (!pr) return handleResponse(res, 404, "Purchase request not found");

    if (String(pr.status) !== "pickup_assigned") {
      return handleResponse(
        res,
        400,
        "Pickup partner must be assigned before handover",
      );
    }

    const expectedHash = pr.pickupOtpHash || "";
    if (!expectedHash || expectedHash !== hashPickupOtp(otp)) {
      return handleResponse(res, 400, "Invalid pickup OTP");
    }
    if (pr.pickupOtpExpiresAt && new Date(pr.pickupOtpExpiresAt) < new Date()) {
      return handleResponse(res, 400, "Pickup OTP expired");
    }

    pr.vendorHandover = {
      confirmedAt: new Date(),
      otpVerifiedAt: new Date(),
      notes: String(notes || ""),
    };
    pr.pickupOtpVerifiedAt = new Date();
    await pr.save();

    return handleResponse(
      res,
      200,
      "Handover OTP verified. Waiting pickup partner confirmation.",
      mapSellerRow(pr.toObject()),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
