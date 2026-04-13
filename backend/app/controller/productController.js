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

    const query = ownerType ? { ownerType } : {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Support both field names for flexibility (backward compatibility)
    const finalHeaderId = header || headerId;
    const finalCategoryId = category || categoryId;
    const finalSubcategoryId = subcategory || subcategoryId;

    if (finalHeaderId) query.headerId = finalHeaderId;
    if (finalCategoryId) query.categoryId = finalCategoryId;
    if (finalSubcategoryId) query.subcategoryId = finalSubcategoryId;

    const requestedSellerIds = parseSellerIdFilters({ sellerId, sellerIds });
    const coords = parseCustomerCoordinates({ lat, lng });
    if (enforceHubOnly) {

      if (!coords.valid) {
      return handleResponse(
        res,
        400,
        "lat and lng are required for customer product visibility",
      );
    }
      const hubRows = await HubInventory.find({
        hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB",
      })
        .select("productId")
        .lean();

      const hubProductIds = (hubRows || [])
        .map((row) => row?.productId && String(row.productId))
        .filter(Boolean);

      // We still want to show products even if they aren't in HubInventory yet, 
      // as long as they are 'admin' products (Master Catalog).
      // This ensures that new catalog entries are visible for procurement.
      query.$or = [
        { _id: { $in: hubProductIds } },
        { ownerType: "admin" }
      ];
      query.status = "active";
    } else {
      if (status) query.status = status;
      if (sellerId) query.sellerId = sellerId;
    }

    // Customer/user app should only see approved active products.
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
        "name slug price salePrice stock brand weight mainImage headerId categoryId subcategoryId sellerId ownerType status isFeatured createdAt",
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
    })
      .select("productId availableQty sellPrice")
      .lean();
    const hubMap = new Map(
      hubRowsForResult.map((r) => [
        String(r.productId),
        {
          availableQty: Number(r.availableQty || 0),
          sellPrice: Number(r.sellPrice || 0),
        },
      ]),
    );


    // --- AGGREGATE SELLER STOCK FOR MASTER PRODUCTS ---
    const productIds = products.map((p) => p._id);
    const sellerStockSummary = await Product.aggregate([
      {
        $match: {
          masterProductId: { $in: productIds },
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

    const sellerStockMap = new Map(
      sellerStockSummary.map((s) => [String(s._id), s.totalSellerStock]),
    );

    const productsWithSource = products.map((p) => {
      const pIdStr = String(p._id);
      const hubRow = hubMap.get(pIdStr) || { availableQty: 0, sellPrice: 0 };
      const hubQty = Number(hubRow.availableQty || 0);
      const hubSellPrice = Number(hubRow.sellPrice || 0);
      
      const mappedSellerStock = sellerStockMap.get(pIdStr) || 0;
      const totalAvailableQty = hubQty + mappedSellerStock;
      
      const salePrice = Number(p.salePrice || 0);
      const catalogPrice = Number(p.price || 0);
      const effectiveCatalogPrice =
        salePrice > 0 && salePrice < catalogPrice ? salePrice : catalogPrice;
      
      const price = hubSellPrice > 0 ? hubSellPrice : effectiveCatalogPrice;

      return {
        ...p,
        price,
        hubSellPrice,
        availableQtyHub: hubQty,
        availableQtySeller: mappedSellerStock, 
        totalAvailableQty, // Sum of Hub + Mapped Sellers
        fulfillmentSource: hubQty > 0 ? "hub" : totalAvailableQty > 0 ? "procure" : "out_of_stock",
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

    const products = await Product.find(query)
      .select(
        "name slug price salePrice stock brand weight mainImage headerId categoryId subcategoryId sellerId ownerType status isFeatured createdAt",
      )
      .populate("headerId", "name")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate("sellerId", "shopName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(query);

    return handleResponse(res, 200, "Seller products fetched", {
      items: products,
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

    // --- AUTO CATALOG LOGIC ---
    if (role !== "admin") {
      // 1. Double-Check uniqueness by NAME for the same seller (Hard block)
      const exactNameExists = await Product.findOne({
        sellerId: req.user.id,
        name: { $regex: new RegExp(`^${String(productData.name || "").trim()}$`, "i") }
      });
      if (exactNameExists) {
        return handleResponse(res, 400, "You already have a product with this name. Please update existing one.");
      }

      if (productData.masterProductId === "" || !productData.masterProductId) {
        delete productData.masterProductId;
      }

      if (!productData.masterProductId) {
        const normalizedName = String(productData.name || "").trim();
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
          const masterSlug = await ensureUniqueSlug(productData.slug || productData.name);
          const masterProduct = await Product.create({
            name: productData.name,
            slug: masterSlug,
            sku: `M-${Date.now().toString().slice(-6)}`,
            description: productData.description,
            price: productData.price,
            salePrice: productData.salePrice,
            unit: productData.unit || "unit",
            mainImage: productData.mainImage,
            galleryImages: productData.galleryImages || [], // Sync all images
            headerId: productData.headerId,
            categoryId: productData.categoryId,
            subcategoryId: productData.subcategoryId,
            brand: productData.brand,
            weight: productData.weight,
            ownerType: "admin",
            status: "inactive", // Stays inactive until seller product is approved
            stock: 0, 
            tags: productData.tags,
          });
          productData.masterProductId = masterProduct._id;

          try {
            await HubInventory.create({
              hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB",
              productId: masterProduct._id,
              availableQty: 0,
              status: "out_of_stock"
            });
          } catch (err) {
            console.warn("Hub Inventory init failed:", err.message);
          }
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

    const product = await Product.create(productData);
    return handleResponse(res, 201, "Product created and sent for approval", product);
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

    // Safety check for masterProductId in updates
    if (productData.masterProductId === "" || productData.masterProductId === "null") {
      productData.masterProductId = null;
    } else if (productData.masterProductId && typeof productData.masterProductId === "string") {
      // If it's a string, ensure it's not empty/invalid
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

    // --- AUTO APPROVAL Logic for Master Product ---
    // If admin is activating a seller product that is linked to a master product,
    // the master product should also be active so it shows up on the app.
    const currentStatus = (productData.status || (req.body && req.body.status) || "").toLowerCase();
    if (role === "admin" && currentStatus === "active") {
      let mid = updatedProduct?.masterProductId;
      
      // Fallback: If no masterProductId is set, try to find one by name
      if (!mid) {
        const matchingMaster = await Product.findOne({
          name: { $regex: new RegExp(`^${updatedProduct.name}$`, "i") },
          ownerType: "admin"
        });
        if (matchingMaster) mid = matchingMaster._id;
      }
      
      if (mid) {
        try {
          await Product.findByIdAndUpdate(mid, { $set: { status: "active" } });
          console.log(`[updateProduct] SUCCESS: Auto-activated master product ${mid} for seller product ${id}`);
        } catch (err) {
          console.warn("[updateProduct] ERROR: Failed to auto-approve master product:", err.message);
        }
      } else {
        console.log(`[updateProduct] INFO: No master product found (by ID or name) for product ${id}.`);
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
