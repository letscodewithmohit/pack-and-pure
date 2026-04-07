import HubInventory from "../models/hubInventory.js";
import Product from "../models/product.js";
import handleResponse from "../utils/helper.js";

const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";

const normalizeStatus = (availableQty, reorderLevel) => {
  if (availableQty <= 0) return "out_of_stock";
  if (availableQty <= reorderLevel) return "low_stock";
  return "healthy";
};

const statusLabel = (status) => {
  if (status === "low_stock") return "Low Stock";
  if (status === "out_of_stock") return "Out of Stock";
  return "Healthy";
};

export const getHubInventory = async (req, res) => {
  try {
    const hubId = String(req.query.hubId || DEFAULT_HUB_ID);
    const rows = await HubInventory.find({ hubId }).sort({ updatedAt: -1 }).lean();

    const productIds = rows.map((r) => r.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } })
      .select("name mainImage categoryId sellerId")
      .populate("categoryId", "name")
      .lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const items = rows.map((row) => {
      const product = productMap.get(String(row.productId));
      const availableQty = Number(row.availableQty || 0);
      const reorderLevel = Number(row.reorderLevel || 0);
      const computed = normalizeStatus(availableQty, reorderLevel);
      return {
        _id: row._id,
        hubId: row.hubId,
        productId: row.productId,
        productName: product?.name || "Unknown Product",
        imageUrl: product?.mainImage || "",
        category: product?.categoryId?.name || "N/A",
        sellerId: product?.sellerId || null,
        hubStockQuantity: availableQty,
        minimumStockAlert: reorderLevel,
        status: computed,
        statusLabel: statusLabel(computed),
        updatedAt: row.updatedAt,
      };
    });

    return handleResponse(res, 200, "Hub inventory fetched", { items });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// SOP style: Add stock by selecting existing catalog product.
export const upsertHubInventory = async (req, res) => {
  try {
    const { productId, quantity, minimumStockAlert, hubId } = req.body;

    if (!productId) {
      return handleResponse(res, 400, "productId is required");
    }

    const product = await Product.findById(productId).select("_id");
    if (!product) {
      return handleResponse(res, 404, "Product not found");
    }

    const qty = Math.max(0, Number(quantity || 0));
    const minAlert = Math.max(0, Number(minimumStockAlert || 0));
    const finalHubId = String(hubId || DEFAULT_HUB_ID);

    let row = await HubInventory.findOne({ hubId: finalHubId, productId });
    if (!row) {
      row = new HubInventory({
        hubId: finalHubId,
        productId,
        availableQty: qty,
        reorderLevel: minAlert,
      });
    } else {
      row.availableQty = Math.max(0, Number(row.availableQty || 0) + qty);
      if (minimumStockAlert !== undefined) {
        row.reorderLevel = minAlert;
      }
    }

    row.status = normalizeStatus(Number(row.availableQty || 0), Number(row.reorderLevel || 0));
    await row.save();

    return handleResponse(res, 200, "Hub inventory upserted", row);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const adjustHubInventoryStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;
    const numericDelta = Number(delta || 0);
    if (!Number.isFinite(numericDelta) || numericDelta === 0) {
      return handleResponse(res, 400, "delta must be a non-zero number");
    }

    const row = await HubInventory.findById(id);
    if (!row) return handleResponse(res, 404, "Hub inventory row not found");

    row.availableQty = Math.max(0, Number(row.availableQty || 0) + numericDelta);
    row.status = normalizeStatus(Number(row.availableQty || 0), Number(row.reorderLevel || 0));
    await row.save();

    return handleResponse(res, 200, "Hub stock updated", row);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateHubInventoryReorderLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { reorderLevel } = req.body;
    const minAlert = Math.max(0, Number(reorderLevel || 0));

    const row = await HubInventory.findById(id);
    if (!row) return handleResponse(res, 404, "Hub inventory row not found");

    row.reorderLevel = minAlert;
    row.status = normalizeStatus(Number(row.availableQty || 0), minAlert);
    await row.save();

    return handleResponse(res, 200, "Minimum stock alert updated", row);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
