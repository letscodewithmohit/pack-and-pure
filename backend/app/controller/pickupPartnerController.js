import PickupPartner from "../models/pickupPartner.js";
import PurchaseRequest from "../models/purchaseRequest.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";

const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";

const mapStatusLabel = (status) => {
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  return "Available";
};

const serializeRow = (row, assignmentStats = new Map()) => {
  const stat = assignmentStats.get(String(row._id)) || {
    totalAssigned: 0,
    activeAssigned: 0,
  };
  return {
    _id: row._id,
    partnerName: row.name,
    phone: row.phone,
    vehicleType: row.vehicleType,
    hubId: row.hubId,
    status: mapStatusLabel(row.status),
    statusRaw: row.status,
    isActive: row.isActive,
    isVerified: row.isVerified,
    assignedPickups: Number(stat.totalAssigned || 0),
    activeAssignedPickups: Number(stat.activeAssigned || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const getPickupPartners = async (req, res) => {
  try {
    const { status, search, hubId = DEFAULT_HUB_ID } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const query = { hubId: String(hubId) };
    if (status && status !== "all") query.status = String(status).toLowerCase();
    if (search) {
      query.$or = [
        { name: { $regex: String(search), $options: "i" } },
        { phone: { $regex: String(search), $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      PickupPartner.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PickupPartner.countDocuments(query),
    ]);

    const partnerIds = rows.map((r) => r._id);
    const assignment = await PurchaseRequest.aggregate([
      { $match: { pickupPartnerId: { $in: partnerIds } } },
      {
        $group: {
          _id: "$pickupPartnerId",
          totalAssigned: { $sum: 1 },
          activeAssigned: {
            $sum: {
              $cond: [{ $in: ["$status", ["pickup_assigned", "picked"]] }, 1, 0],
            },
          },
        },
      },
    ]);
    const statsMap = new Map(
      assignment.map((a) => [String(a._id), { totalAssigned: a.totalAssigned, activeAssigned: a.activeAssigned }]),
    );

    return handleResponse(res, 200, "Pickup partners fetched", {
      items: rows.map((row) => serializeRow(row, statsMap)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const createPickupPartner = async (req, res) => {
  try {
    const { partnerName, phone, vehicleType, hubId = DEFAULT_HUB_ID } = req.body || {};
    if (!partnerName || !String(partnerName).trim()) {
      return handleResponse(res, 400, "partnerName is required");
    }
    if (!phone || !String(phone).trim()) {
      return handleResponse(res, 400, "phone is required");
    }

    const doc = await PickupPartner.create({
      name: String(partnerName).trim(),
      phone: String(phone).trim(),
      vehicleType: String(vehicleType || "bike").trim(),
      hubId: String(hubId),
      status: "available",
      isActive: true,
      isVerified: true,
    });

    return handleResponse(res, 201, "Pickup partner created", serializeRow(doc.toObject()));
  } catch (error) {
    if (error?.code === 11000) {
      return handleResponse(res, 400, "Phone already exists");
    }
    return handleResponse(res, 500, error.message);
  }
};

export const updatePickupPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { partnerName, phone, vehicleType, status, isActive } = req.body || {};

    const doc = await PickupPartner.findById(id);
    if (!doc) return handleResponse(res, 404, "Pickup partner not found");

    if (partnerName !== undefined) doc.name = String(partnerName).trim();
    if (phone !== undefined) doc.phone = String(phone).trim();
    if (vehicleType !== undefined) doc.vehicleType = String(vehicleType).trim();
    if (status !== undefined) doc.status = String(status).toLowerCase();
    if (isActive !== undefined) doc.isActive = Boolean(isActive);

    await doc.save();
    return handleResponse(res, 200, "Pickup partner updated", serializeRow(doc.toObject()));
  } catch (error) {
    if (error?.code === 11000) {
      return handleResponse(res, 400, "Phone already exists");
    }
    return handleResponse(res, 500, error.message);
  }
};

export const updatePickupPartnerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const normalized = String(status || "").toLowerCase();
    if (!["available", "active", "inactive"].includes(normalized)) {
      return handleResponse(res, 400, "Invalid status");
    }

    const doc = await PickupPartner.findById(id);
    if (!doc) return handleResponse(res, 404, "Pickup partner not found");

    doc.status = normalized;
    doc.isActive = normalized !== "inactive";
    await doc.save();

    return handleResponse(res, 200, "Pickup partner status updated", serializeRow(doc.toObject()));
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

