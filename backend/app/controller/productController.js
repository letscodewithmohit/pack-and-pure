import mongoose from "mongoose";
import Product from "../models/product.js";
import HubInventory from "../models/hubInventory.js";
import { handleResponse } from "../utils/helper.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { slugify } from "../utils/slugify.js";
import getPagination from "../utils/pagination.js";
import {
  parseCustomerCoordinates,
  getNearbySellerIdsForCustomer,
} from "../services/customerVisibilityService.js";

function isCustomerVisibilityRequest(req) {
  // If explicitly searching master catalog, it's not a location-bound customer request
  if (req.query.ownerType === "admin") return false;
  
  const role = String(req.user?.role || "").toLowerCase();
  return !role || role === "customer" || role === "user";
}

function parseSellerIdFilters({ sellerId, sellerIds }) {
  if (typeof sellerIds === "string" && sellerIds.trim()) {
    return sellerIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map(String);
  }

  if (sellerId) {
    return [String(sellerId)];
  }

  return [];
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

async function ensureUniqueSlug(baseSlug, excludeId = null) {
  const base = normalizeOptionalString(baseSlug) || "product";
  let candidate = slugify(base);
  if (!candidate) candidate = "product";

  let count = 0;
  while (count < 200) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Product.exists(query);
    if (!exists) return candidate;
    count += 1;
    candidate = `${slugify(base)}-${count + 1}`;
  }

  return `${slugify(base)}-${Date.now()}`;
}

async function ensureUniqueSku(inputSku, excludeId = null) {
  const cleaned = normalizeOptionalString(inputSku).toUpperCase();
  const base = cleaned || `SKU-${Date.now().toString().slice(-8)}`;
  let candidate = base;
  let count = 0;

  while (count < 200) {
    const query = { sku: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Product.exists(query);
    if (!exists) return candidate;
    count += 1;
    candidate = `${base}-${count + 1}`;
  }

  return `${base}-${Math.floor(Math.random() * 10000)}`;
}

/* ===============================
   GET ALL PRODUCTS (Public/Admin)
 ================================ */
export const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      subcategory,
      header,
      status,
      sellerId,
      featured,
      ownerType,
      categoryId,
      subcategoryId,
      headerId,
      categoryIds,
      sellerIds,
      lat,
      lng,
    } = req.query;
    const enforceHubOnly = isCustomerVisibilityRequest(req);

    const query = {};
    
    if (ownerType) query.ownerType = ownerType;
    if (status) query.status = status;
    if (sellerId) query.sellerId = sellerId;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } }
      ];
    }

    const finalHeaderId = header || headerId;
    const finalCategoryId = category || categoryId;
    const finalSubcategoryId = subcategory || subcategoryId;

    if (finalHeaderId) query.headerId = finalHeaderId;
    if (finalCategoryId) query.categoryId = finalCategoryId;
    if (finalSubcategoryId) query.subcategoryId = finalSubcategoryId;

    if (enforceHubOnly) {
      const coords = parseCustomerCoordinates({ lat, lng });
      if (!coords.valid) {
        return handleResponse(res, 400, "lat and lng are required for customer product visibility");
      }
      
      const hubRows = await HubInventory.find({
        hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB",
      }).select("productId").lean();

      const hubProductIds = (hubRows || []).map((row) => row?.productId && String(row.productId)).filter(Boolean);

      query.$or = [
        { _id: { $in: hubProductIds } },
        { ownerType: "admin" }
      ];
      query.status = "active";
    } else {
      if (status) query.status = status;
      if (req.query.ownerType === "admin") {
        query.ownerType = "admin";
      } else {
        if (sellerId) query.sellerId = sellerId;
        if (req.query.ownerType) query.ownerType = req.query.ownerType;
      }
    }

    if (enforceHubOnly) {
      query.status = "active";
    } else if (!status && !req.user?.role) {
      query.status = "active";
    } else if (status) {
      query.status = status;
    }

    // Multiple categories: categoryIds=id1,id2
    if (categoryIds && typeof categoryIds === "string") {
      const ids = categoryIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length) query.categoryId = { $in: ids };
    }
    // Multiple sellers: sellerIds=id1,id2 (or single sellerId)
    if (!query.sellerId) {
      if (sellerIds && typeof sellerIds === "string") {
        const ids = sellerIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        if (ids.length) query.sellerId = { $in: ids };
      } else if (sellerId) {
        query.sellerId = sellerId;
      }
    }

    if (featured !== undefined) query.isFeatured = featured === "true";

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 24,
      maxLimit: 100,
    });

    const products = await Product.find(query)
      .select(
        "name slug price salePrice stock brand weight unit mainImage headerId categoryId subcategoryId sellerId ownerType status isFeatured variants createdAt",
      )
      .populate("headerId", "name")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate("sellerId", "shopName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const hubRowsForResult = await HubInventory.find({
      productId: { $in: products.map((p) => p._id) },
      hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB",
    }).lean();

    const hubMap = new Map();
    hubRowsForResult.forEach(r => {
      if (r.productId) {
        hubMap.set(String(r.productId), Number(r.hubStockQuantity || r.availableQty || 0));
      }
    });

    const productIdsForAgg = products.map((p) => String(p._id)).filter(id => mongoose.Types.ObjectId.isValid(id));
    
    let sellerStockMap = new Map();
    if (productIdsForAgg.length > 0) {
      try {
        const sellerStockSummary = await Product.aggregate([
          {
            $match: {
              masterProductId: { $in: productIdsForAgg.map(id => new mongoose.Types.ObjectId(id)) },
              ownerType: "seller",
              status: "active",
            },
          },
          {
            $group: {
              _id: "$masterProductId",
              totalSellerStock: { $sum: "$stock" },
            },
          },
        ]);
        sellerStockSummary.forEach(s => {
          if (s._id) sellerStockMap.set(String(s._id), Number(s.totalSellerStock || 0));
        });
      } catch (err) {
        console.error("[getProducts] Aggregation Error:", err.message);
      }
    }

    const productsWithSource = products.map((p) => {
      const pIdStr = String(p._id);
      
      if (p.ownerType === 'admin') {
        const hubQty = hubMap.get(pIdStr) || 0;
        const mappedSellerStock = sellerStockMap.get(pIdStr) || 0;
        // Total = Hub Stock + Seller Stock (Master Catalog shows aggregated availability)
        // We do not add p.stock here because p.stock is now synced with hubQty to avoid double counting.
        const totalAvailableQty = hubQty + mappedSellerStock;
        
        return {
          ...p,
          stock: totalAvailableQty,
          availableQtyHub: hubQty,
          availableQtySeller: mappedSellerStock,
          totalAvailableQty,
          fulfillmentSource: hubQty > 0 ? "hub" : totalAvailableQty > 0 ? "procure" : "out_of_stock",
        };
      }
      
      // For seller products, keep their original stock and just check if they are in Hub
      const hubQtyForSeller = hubMap.get(pIdStr) || 0;
      return {
        ...p,
        availableQtyHub: hubQtyForSeller,
        fulfillmentSource: p.stock > 0 ? "direct" : "out_of_stock"
      };
    });

    const total = await Product.countDocuments(query);

    return handleResponse(res, 200, "Products fetched successfully", {
      items: productsWithSource,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SELLER PRODUCTS
 ================================ */
export const getSellerProducts = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { stockStatus } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const query = { sellerId };
    if (stockStatus === "in") {
      query.stock = { $gt: 0 };
    } else if (stockStatus === "out") {
      query.stock = 0;
    }

    const results = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sellerId", "shopName name")
      .populate("headerId", "name")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate({
        path: "masterProductId",
        select: "name sku price salePrice stock"
      })
      .lean();

    // DYNAMIC STOCK SYNC: If master product, sum Hub + Seller stocks
    const finalItems = await Promise.all(results.map(async (p) => {
      if (p.ownerType === 'admin') {
        const hRows = await HubInventory.find({ productId: p._id }).lean();
        const sRows = await Product.find({ masterProductId: p._id, ownerType: 'seller', status: 'active' }).select('stock').lean();
        const hQty = hRows.reduce((s, r) => s + Number(r.hubStockQuantity || 0), 0);
        const sQty = sRows.reduce((s, r) => s + Number(r.stock || 0), 0);
        return { ...p, stock: hQty + sQty, hQty, sQty };
      }
      return p;
    }));

    const total = await Product.countDocuments(query);

    return handleResponse(res, 200, "Products fetched successfully", {
      items: finalItems,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   CREATE PRODUCT
 ================================ */
export const createProduct = async (req, res) => {
  try {
    const productData = { ...req.body };
    const role = String(req.user?.role || "").toLowerCase();

    if (role === "admin") {
      productData.ownerType = "admin";
      productData.sellerId = null;
      productData.status = productData.status || "active";
    } else {
      productData.ownerType = "seller";
      productData.sellerId = req.user.id;
      productData.status = "pending_approval";
    }

    // We will generate the final slugs just before creation to avoid duplicate conflicts between Master and Seller entries
    const initialDesiredSlug = normalizeOptionalString(productData.slug) || productData.name;
    productData.sku = await ensureUniqueSku(productData.sku);

    if (req.files) {
      if (req.files.mainImage && req.files.mainImage[0]) {
        productData.mainImage = await uploadToCloudinary(req.files.mainImage[0].buffer, "products");
      }
      if (req.files.galleryImages && req.files.galleryImages.length > 0) {
        const uploadPromises = req.files.galleryImages.map((file) => uploadToCloudinary(file.buffer, "products"));
        productData.galleryImages = await Promise.all(uploadPromises);
      }
    }

    if (typeof productData.tags === "string") {
      productData.tags = productData.tags.split(",").map((tag) => tag.trim());
    }

    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        productData.variants = [];
      }
    }

    // Typecast numbers to ensure database integrity
    if (productData.price) productData.price = Number(productData.price);
    if (productData.salePrice) productData.salePrice = Number(productData.salePrice);
    if (productData.stock) productData.stock = Number(productData.stock);

    // Standardize masterProductId (remove empty strings which cause BSON errors)
    if (productData.masterProductId === "" || productData.masterProductId === "null" || !productData.masterProductId) {
      delete productData.masterProductId;
    }

    // --- HUB-FIRST CATALOG MAPPING (Only for Sellers) ---
    if (role !== "admin") {
      if (!productData.masterProductId) {
        const normalizedName = String(productData.name || "").trim();
        // Check if an EXACT master product already exists to auto-link
        const existingMaster = await Product.findOne({
          name: { $regex: new RegExp(`^${normalizedName}$`, "i") },
          ownerType: "admin"
        });

        if (existingMaster) {
          productData.masterProductId = existingMaster._id;
          if (!productData.headerId) productData.headerId = existingMaster.headerId;
          if (!productData.categoryId) productData.categoryId = existingMaster.categoryId;
          if (!productData.subcategoryId) productData.subcategoryId = existingMaster.subcategoryId;
        } else {
          // IMPORTANT: We NO LONGER auto-create a master product here.
          // The item stays as masterProductId: null until Admin maps it during approval.
          productData.masterProductId = null;
        }
      }

      // Seller-Specific Duplicate Check
      if (productData.masterProductId) {
        const alreadyExists = await Product.findOne({
          sellerId: req.user.id,
          masterProductId: productData.masterProductId
        });
        if (alreadyExists) {
          return handleResponse(res, 400, "You have already listed this product.");
        }
      }
    }

    // Generate unique slug for seller product now, after master product (if any) is already in DB
    productData.slug = await ensureUniqueSlug(initialDesiredSlug);

    const product = new Product(productData);
    await product.save();

    // Ensure Admin products have an entry in Hub Inventory and sync stock
    if (product.ownerType === "admin") {
      try {
        const HubInventory = mongoose.model("HubInventory");
        await HubInventory.findOneAndUpdate(
          { hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB", productId: product._id },
          { availableQty: Number(product.stock || 0), reorderLevel: Number(product.lowStockAlert || 10) },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.warn("[createProduct] Hub entry sync failed", err.message);
      }
    }

    return handleResponse(res, 201, "Product created successfully", product);
  } catch (error) {
    if (error.code === 11000) return handleResponse(res, 400, "Slug or SKU already exists");
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE PRODUCT
 ================================ */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const role = String(req.user?.role || "").toLowerCase();
    const productData = { ...req.body };
    delete productData.ownerType;

    // Admin bypasses sellerId check
    const query = role === "admin" ? { _id: id } : { _id: id, sellerId };
    const product = await Product.findOne(query);

    if (!product) {
      return handleResponse(res, 404, "Product not found or unauthorized");
    }

    if (role !== "admin") {
      delete productData.status;
      delete productData.sellerId;
      productData.status = "pending_approval";
    }

    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        // Fallback or keep current variants
      }
    }

    // Typecast numbers to ensure database integrity
    if (productData.price) productData.price = Number(productData.price);
    if (productData.salePrice) productData.salePrice = Number(productData.salePrice);
    if (productData.stock) productData.stock = Number(productData.stock);

    // Smart Mapping & Merge Logic: If masterProductId is changed by Admin
    const oldMasterId = product.masterProductId;
    if (role === "admin" && productData.masterProductId && String(oldMasterId) !== String(productData.masterProductId)) {
      try {
        const newMasterId = productData.masterProductId;
        const targetMaster = await Product.findById(newMasterId);

        if (targetMaster) {
          // 1. Normalization: Update the seller's product name/slug to match Master Item
          productData.name = targetMaster.name;
          productData.slug = await ensureUniqueSlug(targetMaster.slug, product._id);
          productData.unit = targetMaster.unit;
          
          // 2. Check for existing record of the same Master ID for this Seller
          const existingSellerProduct = await Product.findOne({
            sellerId: product.sellerId,
            masterProductId: newMasterId,
            _id: { $ne: product._id }
          });

          if (existingSellerProduct) {
            // MERGE CASE: Add current stock to existing record and DELETE this one
            const newTotalStock = (Number(existingSellerProduct.stock) || 0) + (Number(productData.stock || product.stock) || 0);
            await Product.findByIdAndUpdate(existingSellerProduct._id, { stock: newTotalStock });
            
            // Delete the current duplicate product
            await Product.findByIdAndDelete(product._id);

            // Cleanup old master ghost if it was an auto-created orphan
            const oldMaster = await Product.findById(oldMasterId);
            if (oldMaster && oldMaster.ownerType === "admin" && oldMaster.status === "inactive") {
              const otherSellers = await Product.countDocuments({ masterProductId: oldMasterId });
              if (otherSellers === 0) {
                await Product.findByIdAndDelete(oldMasterId);
                await HubInventory.deleteOne({ productId: oldMasterId });
              }
            }

            return handleResponse(res, 200, `Merged into existing ${targetMaster.name} listing. Duplicate removed.`);
          }
        }

        // Cleanup old master ghost (for case where no merge was needed)
        const oldMaster = await Product.findById(oldMasterId);
        if (oldMaster && oldMaster.ownerType === "admin" && oldMaster.status === "inactive") {
          const otherSellers = await Product.countDocuments({ masterProductId: oldMasterId, _id: { $ne: product._id } });
          if (otherSellers === 0) {
            await Product.findByIdAndDelete(oldMasterId);
            await HubInventory.deleteOne({ productId: oldMasterId });
          }
        }
      } catch (err) {
        console.warn("Smart Merge failed", err.message);
      }
    }

    // Standardize masterProductId in update data
    if (productData.masterProductId === "" || productData.masterProductId === "null") {
      productData.masterProductId = null;
    } else if (productData.masterProductId && typeof productData.masterProductId === "string") {
      if (!productData.masterProductId.trim()) {
        productData.masterProductId = null;
      }
    }

    if (productData.name !== undefined || productData.slug !== undefined) {
      const desiredSlug =
        normalizeOptionalString(productData.slug) ||
        normalizeOptionalString(productData.name) ||
        product.slug;
      productData.slug = await ensureUniqueSlug(desiredSlug, product._id);
    }

    if (productData.sku !== undefined) {
      const desiredSku = normalizeOptionalString(productData.sku);
      if (desiredSku) {
        productData.sku = await ensureUniqueSku(desiredSku, product._id);
      } else if (product.sku) {
        // Keep existing SKU if admin leaves field blank in edit form.
        productData.sku = product.sku;
      } else {
        productData.sku = await ensureUniqueSku("", product._id);
      }
    }

    // Handle Images
    if (req.files) {
      // Seller-style images
      if (req.files.mainImage && req.files.mainImage[0]) {
        productData.mainImage = await uploadToCloudinary(
          req.files.mainImage[0].buffer,
          "products",
        );
      }

      if (req.files.galleryImages && req.files.galleryImages.length > 0) {
        const uploadPromises = req.files.galleryImages.map((file) =>
          uploadToCloudinary(file.buffer, "products"),
        );
        productData.galleryImages = await Promise.all(uploadPromises);
      }

      // Admin-style images (array of 'images')
      if (req.files.images && req.files.images.length > 0) {
        const uploadPromises = req.files.images.map((file) =>
          uploadToCloudinary(file.buffer, "products"),
        );
        const uploadedImages = await Promise.all(uploadPromises);

        // For admin, we use the first as mainImage and rest as gallery
        if (uploadedImages.length > 0) {
          productData.mainImage = uploadedImages[0];
          productData.galleryImages = uploadedImages.slice(1);
          // Also support a generic 'images' field if schema has it (some versions did)
          productData.images = uploadedImages;
        }
      }
    }

    if (typeof productData.tags === "string") {
      productData.tags = productData.tags.split(",").map((tag) => tag.trim());
    }

    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        // keep existing if invalid?
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: productData },
      { new: true, runValidators: true },
    );

    // --- AUTO APPROVAL & PRICE SYNC Logic for Master Product ---
    // If admin is activating a seller product or changing its customer-facing price,
    // we sync it to the master product.
    const currentStatus = (productData.status || (req.body && req.body.status) || "").toLowerCase();
    const customerPrice = Number(req.body.customerPrice);

    if (role === "admin") {
      let mid = updatedProduct?.masterProductId;
      
      if (!mid) {
        const matchingMaster = await Product.findOne({
          name: { $regex: new RegExp(`^${updatedProduct.name}$`, "i") },
          ownerType: "admin"
        });
        if (matchingMaster) mid = matchingMaster._id;
      }
      
      if (mid) {
        const masterUpdate = {};
        if (currentStatus === "active") masterUpdate.status = "active";
        // If admin provided a specific customerPrice, update the Master Product's price
        if (!isNaN(customerPrice) && customerPrice > 0) {
          masterUpdate.price = customerPrice;
          masterUpdate.salePrice = customerPrice; // Set both for consistency
        }

        if (Object.keys(masterUpdate).length > 0) {
          try {
            await Product.findByIdAndUpdate(mid, { $set: masterUpdate });
            console.log(`[updateProduct] SUCCESS: Synced Master Product ${mid} (Status: ${masterUpdate.status}, Price: ${customerPrice})`);
          } catch (err) {
            console.warn("[updateProduct] ERROR: Failed to sync master product:", err.message);
          }
        }
      }
    }

    // Ensure Admin products have an entry in Hub Inventory and sync stock
    if (updatedProduct.ownerType === "admin") {
      try {
        const HubInventory = mongoose.model("HubInventory");
        await HubInventory.findOneAndUpdate(
          { hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB", productId: updatedProduct._id },
          { availableQty: Number(updatedProduct.stock || 0), reorderLevel: Number(updatedProduct.lowStockAlert || 10) },
          { upsert: true }
        );
      } catch (err) {
        console.warn("[updateProduct] Hub entry sync failed", err.message);
      }
    }

    return handleResponse(
      res,
      200,
      "Product updated successfully",
      updatedProduct,
    );
  } catch (error) {
    console.error("Update Product Error:", error);
    if (error.name === "ValidationError") {
      return handleResponse(
        res,
        400,
        Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      );
    }
    if (error.name === "CastError") {
      return handleResponse(res, 400, `Invalid ${error.path}: ${error.value}`);
    }
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0];
      const field = key || "Slug or SKU";
      return handleResponse(res, 400, `${field} already exists`);
    }
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   DELETE PRODUCT
 ================================ */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const role = req.user.role;

    const query = role === "admin" ? { _id: id } : { _id: id, sellerId };
    const product = await Product.findOneAndDelete(query);

    if (!product) {
      return handleResponse(res, 404, "Product not found or unauthorized");
    }

    return handleResponse(res, 200, "Product deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SINGLE PRODUCT
 ================================ */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const enforceRadius = isCustomerVisibilityRequest(req);

    let nearbySellerSet = null;
    const coords = parseCustomerCoordinates(req.query || {});
    if (enforceRadius) {
      if (!coords.valid) {
        return handleResponse(
          res,
          400,
          "lat and lng are required for customer product visibility",
        );
      }
      const nearbySellerIds = await getNearbySellerIdsForCustomer(
        coords.lat,
        coords.lng,
      );
      nearbySellerSet = new Set(nearbySellerIds.map(String));
    }

    const product = await Product.findById(id)
      .populate("headerId", "name")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate("sellerId", "shopName");

    if (!product) {
      return handleResponse(res, 404, "Product not found");
    }

    if (enforceRadius) {
      if (String(product.status || "") !== "active") {
        return handleResponse(res, 404, "Product not available");
      }
      const sellerIdForProduct = String(product.sellerId?._id || product.sellerId);
      if (!nearbySellerSet || !nearbySellerSet.has(sellerIdForProduct)) {
        return handleResponse(res, 404, "Product not available in your area");
      }
    }

    return handleResponse(res, 200, "Product details fetched", product);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
