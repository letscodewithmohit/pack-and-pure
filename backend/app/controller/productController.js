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

    // Quick Filters based on stock status
    if (req.query.stockStatus === 'active') {
      query.status = 'active';
    } else if (req.query.stockStatus === 'low_stock') {
      query.stock = { $gt: 0, $lte: 10 };
    } else if (req.query.stockStatus === 'out_of_stock') {
      query.stock = 0;
    }

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
      
      const hubId = process.env.DEFAULT_HUB_ID || "MAIN_HUB";
      const [hubRows, sellerMasterIds] = await Promise.all([
        HubInventory.find({ hubId, availableQty: { $gt: 0 } })
          .select("productId")
          .lean(),
        Product.distinct("masterProductId", {
          ownerType: "seller",
          status: "active",
          stock: { $gt: 0 },
          masterProductId: { $ne: null },
        }),
      ]);

      const eligibleIds = Array.from(
        new Set([
          ...(hubRows || []).map((row) => row?.productId && String(row.productId)).filter(Boolean),
          ...(sellerMasterIds || []).map((id) => id && String(id)).filter(Boolean),
        ]),
      );

      query.ownerType = "admin";
      query.status = "active";
      query._id = { $in: eligibleIds };
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
        "name slug description price salePrice purchasePrice stock brand weight unit mainImage headerId categoryId subcategoryId sellerId ownerType status isFeatured variants gstRate createdAt",
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
              totalSellerStock: {
                $sum: {
                  $cond: {
                    if: { $and: [{ $isArray: "$variants" }, { $gt: [{ $size: "$variants" }, 0] }] },
                    then: {
                      $reduce: {
                        input: "$variants",
                        initialValue: 0,
                        in: { $add: ["$$value", { $ifNull: ["$$this.stock", 0] }] }
                      }
                    },
                    else: { $ifNull: ["$stock", 0] }
                  }
                }
              },
              minPurchasePrice: { $min: "$purchasePrice" },
              avgPurchasePrice: { $avg: "$purchasePrice" }
            },
          },
        ]);
        sellerStockSummary.forEach(s => {
          if (s._id) {
            sellerStockMap.set(String(s._id), {
              stock: Number(s.totalSellerStock || 0),
              cost: Number(s.minPurchasePrice || s.avgPurchasePrice || 0)
            });
          }
        });
      } catch (err) {
        console.error("[getProducts] Aggregation Error:", err.message);
      }
    }

    const masterIds = products.map(p => p.masterProductId).filter(Boolean);
    const masterProducts = masterIds.length > 0 ? await Product.find({ _id: { $in: masterIds } }).select('price salePrice').lean() : [];

    const productsWithSource = products.map((p) => {
      const pIdStr = String(p._id);
      const hubData = hubRowsForResult.find(r => String(r.productId) === pIdStr);
      
      if (p.ownerType === 'admin') {
        const hubQty = hubData ? Number(hubData.hubStockQuantity || hubData.availableQty || 0) : 0;
        const mappedSellerData = sellerStockMap.get(pIdStr) || { stock: 0, cost: p.purchasePrice || 0 };
        const mappedSellerStock = mappedSellerData.stock;
        const totalAvailableQty = hubQty + mappedSellerStock;
        
        // SOP Alignment: Use dynamic sellPrice from Hub Inventory if available
        const dynamicPrice = hubData?.sellPrice && hubData.sellPrice > 0 ? hubData.sellPrice : p.salePrice || p.price;
        
        const syncedVariants = (p.variants || []).map((v, i) => {
          if (i === 0 || !v.stock) {
            return { ...v, stock: totalAvailableQty, price: dynamicPrice, salePrice: dynamicPrice };
          }
          return v;
        });

        return {
          ...p,
          price: dynamicPrice, // Override with Hub Price
          salePrice: dynamicPrice,
          purchasePrice: mappedSellerData.cost, // Use min seller cost for master profit calculation
          stock: totalAvailableQty,
          availableQtyHub: hubQty,
          availableQtySeller: mappedSellerStock,
          totalAvailableQty,
          variants: syncedVariants,
          fulfillmentSource: hubQty > 0 ? "hub" : totalAvailableQty > 0 ? "procure" : "out_of_stock",
        };
      }
      
      const masterProduct = masterProducts.find(m => String(m._id) === String(p.masterProductId));
      const customerPrice = masterProduct ? (masterProduct.salePrice || masterProduct.price) : (p.salePrice || p.price);

      // For seller products, check for hub price too if linked to a master
      const hubQtyForSeller = hubData ? Number(hubData.availableQty || 0) : 0;
      const vSum = (p.variants && p.variants.length > 0) ? p.variants.reduce((sum, v) => sum + (Number(v.stock) || Number(p.stock) || 0), 0) : (Number(p.stock) || 0);
      const calcStock = vSum > 0 ? vSum : (Number(p.stock) || 0);

      const syncedVariants = (p.variants || []).map((v, i) => {
        const parsedStock = Number(v.stock);
        return {
          ...v,
          stock: Number.isFinite(parsedStock) ? parsedStock : calcStock
        };
      });

      return {
        ...p,
        price: customerPrice || p.price,
        salePrice: customerPrice || p.salePrice,
        availableQtyHub: hubQtyForSeller,
        stock: calcStock,
        variants: syncedVariants,
        fulfillmentSource: calcStock > 0 ? "direct" : "out_of_stock"
      };
    });

    const statsQuery = { ...query };
    delete statsQuery.status;
    delete statsQuery.stock;
    if (query.ownerType) statsQuery.ownerType = query.ownerType;

    const [total, activeCount, lowStockCount, outOfStockCount] = await Promise.all([
      Product.countDocuments(statsQuery),
      Product.countDocuments({ ...statsQuery, status: 'active' }),
      Product.countDocuments({ ...statsQuery, stock: { $gt: 0, $lte: 10 } }),
      Product.countDocuments({ ...statsQuery, stock: 0 }),
    ]);

    return handleResponse(res, 200, "Products fetched successfully", {
      items: productsWithSource,
      page,
      limit,
      total,
      stats: {
        total,
        active: activeCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount
      },
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

      // HUB-FIRST SOP: Seller price represents procurement/supply cost for Hub.
      // Normalize seller pricing so `price`, `salePrice`, and `purchasePrice` stay consistent.
      if (productData.price !== undefined) {
        const supply = Number(productData.price);
        if (Number.isFinite(supply)) {
          productData.price = supply;
          productData.salePrice = supply;
          productData.purchasePrice = supply;
        }
      }
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
    if (productData.purchasePrice) productData.purchasePrice = Number(productData.purchasePrice);
    if (productData.stock) productData.stock = Number(productData.stock);

    if (Array.isArray(productData.variants) && productData.variants.length > 0) {
      productData.variants = productData.variants.map(v => {
        const parsedStock = Number(v.stock);
        return {
          ...v,
          price: Number(v.price) || Number(productData.price) || 0,
          salePrice: Number(v.salePrice || v.price) || Number(productData.salePrice || productData.price) || 0,
          stock: Number.isFinite(parsedStock) ? parsedStock : (Number(productData.stock) || 0)
        };
      });
    }

    // If seller is creating, their price is the purchasePrice for the admin
    if (role !== "admin") {
      productData.purchasePrice = productData.price || 0;
    }

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

    // Ensure Admin products have an entry in Hub Inventory
    if (product.ownerType === "admin") {
      try {
        // We initialize with 0! Stock should come from Hub Inventory management or Seller procurement.
        const seededSellPrice = Number(productData.salePrice || 0) > 0
          ? Number(productData.salePrice)
          : Number(productData.price || 0);

        await HubInventory.findOneAndUpdate(
          { hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB", productId: product._id },
          { 
            $setOnInsert: {
              availableQty: Number(productData.stock || 0),
              reservedQty: 0,
              sellPrice: seededSellPrice > 0 ? seededSellPrice : 0,
              priceUpdatedAt: new Date(),
            },
            $set: { reorderLevel: Number(productData.lowStockAlert || 10) },
          },
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

    if (role === "admin" && product.ownerType === "seller") {
      let parsedVars = [];
      if (typeof productData.variants === "string") {
        try {
          parsedVars = JSON.parse(productData.variants);
        } catch (e) {}
      } else if (Array.isArray(productData.variants)) {
        parsedVars = productData.variants;
      }

      const sellPrice = Number(productData.customerPrice || productData.price || productData.salePrice);
      if (product.masterProductId) {
        const masterUpdate = {};
        if (sellPrice > 0) {
          masterUpdate.price = sellPrice;
          masterUpdate.salePrice = sellPrice;
        }
        if (parsedVars && parsedVars.length > 0) {
          masterUpdate.variants = parsedVars.map(v => ({
            name: v.name,
            price: Number(v.price) || sellPrice,
            salePrice: Number(v.salePrice || v.price) || sellPrice,
            sku: v.sku || ''
          }));
        }
        if (Object.keys(masterUpdate).length > 0) {
          await Product.findByIdAndUpdate(product.masterProductId, { $set: masterUpdate });
          if (sellPrice > 0) {
            await mongoose.model("HubInventory").updateMany({ productId: product.masterProductId }, { $set: { sellPrice: sellPrice } });
          }
        }
      } else if (sellPrice > 0) {
        let existingMaster = await Product.findOne({
          name: { $regex: new RegExp(`^${String(product.name || '').trim()}$`, "i") },
          ownerType: "admin"
        });
        
        if (!existingMaster) {
          const masterSlug = await ensureUniqueSlug(product.slug + "-master");
          const masterSku = await ensureUniqueSku(`M-${product.sku || Date.now()}`);

          const newMasterData = {
            name: product.name,
            slug: masterSlug,
            sku: masterSku,
            description: product.description,
            price: sellPrice,
            salePrice: sellPrice,
            purchasePrice: product.price || 0,
            stock: product.stock || 0,
            unit: product.unit || 'Pieces',
            headerId: product.headerId,
            categoryId: product.categoryId,
            subcategoryId: product.subcategoryId,
            brand: product.brand,
            weight: product.weight,
            tags: product.tags,
            status: "active",
            ownerType: "admin",
            mainImage: product.mainImage,
            galleryImages: product.galleryImages,
            variants: parsedVars.length > 0 ? parsedVars.map(v => {
              const parsedStock = Number(v.stock);
              return {
                name: v.name,
                price: Number(v.price) || sellPrice,
                salePrice: Number(v.salePrice || v.price) || sellPrice,
                stock: Number.isFinite(parsedStock) ? parsedStock : (Number(product.stock) || 0),
                sku: v.sku || ''
              };
            }) : (product.variants || []).map(v => {
              const vObj = v.toObject ? v.toObject() : v;
              const parsedStock = Number(vObj.stock);
              return {
                ...vObj,
                price: Number(vObj.price) || sellPrice,
                salePrice: Number(vObj.salePrice || vObj.price) || sellPrice,
                stock: Number.isFinite(parsedStock) ? parsedStock : (Number(product.stock) || 0),
                sku: vObj.sku || ''
              };
            })
          };
          existingMaster = new Product(newMasterData);
          await existingMaster.save();
        } else {
          existingMaster.price = sellPrice;
          existingMaster.salePrice = sellPrice;
          await existingMaster.save();
        }
        
        productData.masterProductId = existingMaster._id;
      }

      delete productData.price;
      delete productData.salePrice;
      delete productData.purchasePrice;
      delete productData.customerPrice;
      delete productData.sellerId;
    } else if (role !== "admin") {
      delete productData.sellerId;
      
      // SOP: If seller is ONLY updating stock/images, don't force re-approval
      // If name, price or category changes, then it must go back to pending
      const sensitiveFields = ['name', 'price', 'salePrice', 'categoryId', 'subcategoryId'];
      const isSensitiveChange = sensitiveFields.some(f => productData[f] !== undefined && String(productData[f]) !== String(product[f]));
      
      if (isSensitiveChange) {
        productData.status = "pending_approval";
      } else {
        delete productData.status; // Keep existing status (active/rejected/etc)
      }
    }

    if (Array.isArray(productData.variants) && productData.variants.length > 0) {
      let totalStock = 0;
      productData.variants = productData.variants.map(v => {
        const vStock = Number(v.stock) || 0;
        totalStock += vStock;
        return {
          ...v,
          price: Number(v.price) || Number(productData.price || product.price) || 0,
          salePrice: Number(v.salePrice || v.price) || Number(productData.salePrice || productData.price || product.salePrice) || 0,
          stock: vStock
        };
      });
      productData.stock = totalStock;
    }

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

    if (Array.isArray(productData.variants) && productData.variants.length > 0) {
      productData.variants = productData.variants.map(v => {
        const parsedStock = Number(v.stock);
        return {
          ...v,
          price: Number(v.price) || Number(productData.price) || (product ? product.price : 0),
          salePrice: Number(v.salePrice || v.price) || Number(productData.salePrice || productData.price) || (product ? product.salePrice : 0),
          stock: Number.isFinite(parsedStock) ? parsedStock : (Number(productData.stock) || (product ? product.stock : 0))
        };
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: productData },
      { new: true, runValidators: true },
    );

    // SYNC PRICE & STOCK: Ensure consistency between main product and variants
    const updates = {};
    if (updatedProduct.variants && updatedProduct.variants.length > 0) {
      if (updatedProduct.variants.length === 1 && productData.stock !== undefined) {
         // Special Case: If only 1 variant (Simple Product), sync variant stock with main stock
         updatedProduct.variants[0].stock = Number(productData.stock);
         updates.variants = updatedProduct.variants;
         updates.stock = Number(productData.stock);
      } else {
         const totalVariantStock = updatedProduct.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
         if (updatedProduct.stock !== totalVariantStock) updates.stock = totalVariantStock;
      }
    }
      
      // If price was updated, ensure variants match, or if variant 0 price is different, update main
      // For Master Products, we want all variants to stay in sync with the master price
      if (role === "admin") {
         const newPrice = Number(productData.price || updatedProduct.price);
         if (newPrice > 0) {
            updates.price = newPrice;
            updates.salePrice = newPrice;
            
            // Map variants to new price
            const syncedVariants = updatedProduct.variants.map(v => ({
               ...v.toObject(),
               price: newPrice,
               salePrice: newPrice
            }));
            updates.variants = syncedVariants;
         }
      }

      if (Object.keys(updates).length > 0) {
        await Product.findByIdAndUpdate(id, { $set: updates });
      }

    // --- UNIVERSAL PROPAGATION: Master to Hub Inventory (Customer Selling Price) ---
    if (updatedProduct.ownerType === 'admin') {
        const currentMasterPrice = Number(productData.price || updatedProduct.price);
        if (currentMasterPrice > 0) {
            await mongoose.model("HubInventory").updateMany({ productId: id }, { $set: { sellPrice: currentMasterPrice } });
            console.log(`[Hub Sync] Master Product ${id} price updated. Customer selling price synced to Hub: ₹${currentMasterPrice}`);
            // Note: We NO LONGER update seller prices here. Sellers maintain their own procurement rates.
        }
    }

    // --- AUTO APPROVAL & MASTER PROMOTION Logic ---
    const currentStatus = (productData.status || (req.body && req.body.status) || "").toLowerCase();
    const customerPrice = Number(req.body.customerPrice);

    if (role === "admin") {
      let mid = updatedProduct?.masterProductId;
      
      // 1. Try to find an existing master if not linked
      if (!mid) {
        const matchingMaster = await Product.findOne({
          name: { $regex: new RegExp(`^${updatedProduct.name}$`, "i") },
          ownerType: "admin"
        });
        if (matchingMaster) {
          mid = matchingMaster._id;
          // Link it now so future edits are consistent
          await Product.findByIdAndUpdate(updatedProduct._id, { masterProductId: mid });
        }
      }
      
      // 2. PROMOTION: If still no master and admin is activating, create a Master Record automatically
      if (!mid && currentStatus === "active") {
        try {
          console.log(`[updateProduct] No master found for ${updatedProduct.name}. Promoting to Master Catalog...`);
          
          const masterSlug = await ensureUniqueSlug(updatedProduct.slug);
          const masterSku = await ensureUniqueSku(`M-${updatedProduct.sku || Date.now()}`);
          
          const newMaster = new Product({
            name: updatedProduct.name,
            slug: masterSlug,
            sku: masterSku,
            ownerType: "admin",
            status: "active",
            headerId: updatedProduct.headerId,
            categoryId: updatedProduct.categoryId,
            subcategoryId: updatedProduct.subcategoryId,
            unit: updatedProduct.unit,
            mainImage: updatedProduct.mainImage,
            galleryImages: updatedProduct.galleryImages,
            description: updatedProduct.description,
            price: customerPrice || updatedProduct.price, 
            salePrice: customerPrice || updatedProduct.salePrice,
            purchasePrice: updatedProduct.price, // Seller's price is Admin's cost
            stock: 0,
            variants: (updatedProduct.variants || []).map(v => {
              const vObj = v.toObject ? v.toObject() : v;
              return {
                ...vObj,
                purchasePrice: vObj.price, // Map seller's price to purchasePrice
                price: customerPrice || vObj.price,
                salePrice: customerPrice || vObj.price
              };
            })
          });
          
          const savedMaster = await newMaster.save();
          mid = savedMaster._id;
          
          // Link the seller product to this new master
          await Product.findByIdAndUpdate(updatedProduct._id, { masterProductId: mid });
          
          // Initialize Hub Inventory for this new master
          const HubInventory = mongoose.model("HubInventory");
          await HubInventory.findOneAndUpdate(
            { hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB", productId: mid },
            { $setOnInsert: { availableQty: 0, reservedQty: 0 } },
            { upsert: true }
          );
          
          console.log(`[updateProduct] SUCCESS: Created new Master Product ${mid} from approved Seller item.`);
        } catch (promErr) {
          console.error("[updateProduct] Master promotion failed:", promErr.message);
        }
      }
      
      // 3. SYNC: If we have a master ID, ensure status and customerPrice are synced ONLY to Master Catalog
      if (mid) {
        const masterUpdate = {};
        if (currentStatus === "active") masterUpdate.status = "active";
        
        // If Admin sends customerPrice, it updates the Master Catalog ONLY.
        // This ensures Seller's Vendor Price (Supply Price) stays separate.
        if (!isNaN(customerPrice) && customerPrice > 0) {
          masterUpdate.price = customerPrice;
          masterUpdate.salePrice = customerPrice;
          
          // SYNC VARIANTS: Ensure variants in Master Catalog also get the Selling Price
          const targetMaster = await Product.findById(mid);
          if (targetMaster && targetMaster.variants && targetMaster.variants.length > 0) {
            masterUpdate.variants = targetMaster.variants.map(v => {
              const variantObj = v.toObject ? v.toObject() : v;
              return {
                ...variantObj,
                price: customerPrice,
                salePrice: customerPrice
              };
            });
          }
        }

        if (Object.keys(masterUpdate).length > 0) {
          try {
            await Product.findByIdAndUpdate(mid, { $set: masterUpdate });
            console.log(`[updateProduct] SUCCESS: Synced Master Product ${mid} with Customer Price: ₹${customerPrice || 'N/A'}`);
          } catch (err) {
            console.warn("[updateProduct] ERROR: Failed to sync master product:", err.message);
          }
        }
      }
    }

    // Ensure Admin products have an entry in Hub Inventory
    if (updatedProduct.ownerType === "admin") {
      try {
        const candidateSellPrice =
          !isNaN(customerPrice) && customerPrice > 0
            ? Number(customerPrice)
            : Number(updatedProduct.salePrice || 0) > 0
              ? Number(updatedProduct.salePrice)
              : Number(updatedProduct.price || 0);

        // Only seed hub sellPrice if it hasn't been set yet (0).
        // Hub Inventory price can be manually overridden from the Hub panel.
        await HubInventory.findOneAndUpdate(
          { hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB", productId: updatedProduct._id },
          { 
            $setOnInsert: { availableQty: 0 }, 
            $set: { reorderLevel: Number(updatedProduct.lowStockAlert || 10) },
          },
          { upsert: true }
        );

        if (candidateSellPrice > 0) {
          await HubInventory.updateMany(
            {
              hubId: process.env.DEFAULT_HUB_ID || "MAIN_HUB",
              productId: updatedProduct._id,
              $or: [{ sellPrice: { $exists: false } }, { sellPrice: { $lte: 0 } }],
            },
            { $set: { sellPrice: candidateSellPrice, priceUpdatedAt: new Date() } },
          );
        }
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
      .populate("sellerId", "shopName")
      .populate("masterProductId", "description brand weight unit variants images mainImage");

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

/**
 * Utility to propagate price changes from a Master Product to all linked seller products.
 * Used by other controllers (e.g., during Stock Inwarding).
 */
export const propagatePriceUpdates = async (masterProduct) => {
    try {
        if (!masterProduct || masterProduct.ownerType !== 'admin') return;

        const newPrice = Number(masterProduct.price || masterProduct.salePrice || 0);
        if (newPrice <= 0) return;

        console.log(`[Exported Sync] Triggering full sync for Master ${masterProduct._id} -> ₹${newPrice}`);

        // 1. Update Hub Inventory selling price
        await mongoose.model("HubInventory").updateMany(
            { productId: masterProduct._id },
            { $set: { sellPrice: newPrice } }
        );

        console.log(`[Exported Sync] Hub price updated for Master ${masterProduct._id} -> ₹${newPrice}. Seller prices preserved.`);
    } catch (err) {
        console.error("[propagatePriceUpdates] Sync failed:", err.message);
    }
};
