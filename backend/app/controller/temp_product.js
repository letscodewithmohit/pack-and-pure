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

    const desiredSlug = normalizeOptionalString(productData.slug) || productData.name;
    productData.slug = await ensureUniqueSlug(desiredSlug);
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
            unit: productData.unit,
            mainImage: productData.mainImage,
            galleryImages: productData.galleryImages,
            headerId: productData.headerId || null,
            categoryId: productData.categoryId || null,
            subcategoryId: productData.subcategoryId || null,
            brand: productData.brand,
            weight: productData.weight,
            ownerType: "admin",
            status: "inactive",
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

    const product = await Product.create(productData);
    return handleResponse(res, 201, "Product created and sent for approval", product);
  } catch (error) {
    if (error.code === 11000) return handleResponse(res, 400, "Slug or SKU already exists");
    return handleResponse(res, 500, error.message);
  }
};
