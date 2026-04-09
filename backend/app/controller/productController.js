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
      categoryId,
      subcategoryId,
      headerId,
      categoryIds,
      sellerIds,
      lat,
      lng,
    } = req.query;
    const enforceRadius = isCustomerVisibilityRequest(req);

    const query = {};
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
    const shouldApplyLocationFilter = enforceRadius || coords.valid;
    let finalSellerIdsForScope = [];
    let hubProductIdsForScope = [];
    if (enforceRadius && !coords.valid) {
      return handleResponse(
        res,
        400,
        "lat and lng are required for customer product visibility",
      );
    }
    if (shouldApplyLocationFilter) {
      const [nearbySellerIds, hubRows] = await Promise.all([
        getNearbySellerIdsForCustomer(coords.lat, coords.lng),
        HubInventory.find({
          hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB",
          availableQty: { $gt: 0 },
        })
          .select("productId availableQty")
          .lean(),
      ]);

      const nearbySet = new Set((nearbySellerIds || []).map(String));
      finalSellerIdsForScope = requestedSellerIds.length
        ? requestedSellerIds.filter((id) => nearbySet.has(String(id)))
        : nearbySellerIds || [];

      hubProductIdsForScope = (hubRows || [])
        .map((row) => row?.productId && String(row.productId))
        .filter(Boolean);

      const visibilityOr = [];
      if (finalSellerIdsForScope.length) {
        visibilityOr.push({ sellerId: { $in: finalSellerIdsForScope } });
      }
      if (hubProductIdsForScope.length) {
        visibilityOr.push({ _id: { $in: hubProductIdsForScope } });
      }

      if (!visibilityOr.length) {
        return handleResponse(res, 200, "No products available in your area", {
          items: [],
          page: 1,
          limit: 24,
          total: 0,
          totalPages: 1,
        });
      }

      query.$or = visibilityOr;
    }

    // Customer/user app should only see approved active products.
    if (enforceRadius) {
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
        "name slug price salePrice stock brand weight mainImage headerId categoryId subcategoryId sellerId status isFeatured createdAt",
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
      .select("productId availableQty")
      .lean();
    const hubQtyMap = new Map(
      hubRowsForResult.map((r) => [String(r.productId), Number(r.availableQty || 0)]),
    );
    const sellerSet = new Set((finalSellerIdsForScope || []).map(String));

    const productsWithSource = products.map((p) => {
      const hubQty = Number(hubQtyMap.get(String(p._id)) || 0);
      const sellerVisible = sellerSet.has(String(p.sellerId?._id || p.sellerId));
      let fulfillmentSource = "seller";
      if (hubQty > 0 && sellerVisible) fulfillmentSource = "hybrid";
      else if (hubQty > 0) fulfillmentSource = "hub";

      return {
        ...p,
        availableQtyHub: hubQty,
        availableQtySeller: Number(p.stock || 0),
        fulfillmentSource,
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
        "name slug price salePrice stock brand weight mainImage headerId categoryId subcategoryId sellerId status isFeatured createdAt",
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
    productData.sellerId = req.user.id;
    // Seller-created products require admin approval before going live.
    productData.status = "pending_approval";

    // Always resolve to a unique slug/SKU to avoid approval-time duplicate failures.
    const desiredSlug = normalizeOptionalString(productData.slug) || productData.name;
    productData.slug = await ensureUniqueSlug(desiredSlug);
    productData.sku = await ensureUniqueSku(productData.sku);

    // Handle Images
    if (req.files) {
      // Main Image
      if (req.files.mainImage && req.files.mainImage[0]) {
        productData.mainImage = await uploadToCloudinary(
          req.files.mainImage[0].buffer,
          "products",
        );
      }

      // Gallery Images
      if (req.files.galleryImages && req.files.galleryImages.length > 0) {
        const uploadPromises = req.files.galleryImages.map((file) =>
          uploadToCloudinary(file.buffer, "products"),
        );
        productData.galleryImages = await Promise.all(uploadPromises);
      }
    }

    // Handle tags if string
    if (typeof productData.tags === "string") {
      productData.tags = productData.tags.split(",").map((tag) => tag.trim());
    }

    // Handle variants if string (multipart/form-data sends as string)
    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        productData.variants = [];
      }
    }

    const product = await Product.create(productData);
    return handleResponse(res, 201, "Product created successfully", product);
  } catch (error) {
    console.error("Create Product Error:", error);
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0];
      const field = key || "Slug or SKU";
      return handleResponse(res, 400, `${field} already exists`);
    }
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
    const role = req.user.role;
    const productData = { ...req.body };

    // Admin bypasses sellerId check
    const query = role === "admin" ? { _id: id } : { _id: id, sellerId };
    const product = await Product.findOne(query);

    if (!product) {
      return handleResponse(res, 404, "Product not found or unauthorized");
    }

    // Sellers cannot self-publish updates; any seller-side change re-enters approval queue.
    if (role !== "admin") {
      delete productData.status;
      productData.status = "pending_approval";
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
