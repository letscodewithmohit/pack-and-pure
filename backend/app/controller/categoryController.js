import Category from "../models/category.js";
import mongoose from "mongoose";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

const CATEGORY_TYPES = new Set(["header", "category", "subcategory"]);

const normalizeParentId = (value) => {
  if (value === "" || value === "null" || value === null || value === undefined) return null;
  return value;
};

const validateHierarchy = async ({
  res,
  type,
  parentId,
  currentId = null,
}) => {
  if (!CATEGORY_TYPES.has(type)) {
    handleResponse(res, 400, "Invalid category type");
    return { ok: false };
  }

  if (type === "header") {
    if (parentId) {
      handleResponse(res, 400, "Header cannot have a parent");
      return { ok: false };
    }
    return { ok: true };
  }

  if (!parentId) {
    handleResponse(res, 400, "Parent is required for this category type");
    return { ok: false };
  }

  if (!mongoose.Types.ObjectId.isValid(parentId)) {
    handleResponse(res, 400, "Invalid parent category id");
    return { ok: false };
  }

  if (currentId && String(parentId) === String(currentId)) {
    handleResponse(res, 400, "Category cannot be its own parent");
    return { ok: false };
  }

  const parent = await Category.findById(parentId).select("type").lean();
  if (!parent) {
    handleResponse(res, 400, "Parent category not found");
    return { ok: false };
  }

  if (type === "category" && parent.type !== "header") {
    handleResponse(res, 400, "Category parent must be a header");
    return { ok: false };
  }
  if (type === "subcategory" && parent.type !== "category") {
    handleResponse(res, 400, "Subcategory parent must be a category");
    return { ok: false };
  }

  return { ok: true };
};

/* ===============================
   GET ALL CATEGORIES (Hierarchy)
================================ */
export const getCategories = async (req, res) => {
  try {
    const { flat, tree, type } = req.query;

    // If tree structure is requested (for hierarchy explorer / public navigation)
    if (tree === "true") {
      const selectFields = "name slug image iconId type parentId headerColor order";
      const categories = await Category.find({ type: "header" })
        .select(selectFields)
        .populate({
          path: "children",
          select: selectFields,
          options: { sort: { order: 1, name: 1 } },
          populate: {
            path: "children",
            select: selectFields,
            options: { sort: { order: 1, name: 1 } },
          },
        })
        .sort({ order: 1, name: 1 })
        .lean();
      return handleResponse(res, 200, "Category tree fetched", categories);
    }

    // Paginated flat list (for table views)
    const pageParam = req.query.page;
    const limitParam = req.query.limit;
    if (pageParam != null || limitParam != null) {
      const { page, limit, skip } = getPagination(req, {
        defaultLimit: 25,
        maxLimit: 100,
      });
      const query = {};
      if (type === "header" || type === "category" || type === "subcategory") {
        query.type = type;
      }
      const search = (req.query.search || "").trim();
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { slug: { $regex: search, $options: "i" } },
        ];
      }
      const [items, total] = await Promise.all([
        Category.find(query).sort({ order: 1, name: 1 }).skip(skip).limit(limit).lean(),
        Category.countDocuments(query),
      ]);
      return handleResponse(res, 200, "Categories fetched successfully", {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      });
    }

    // Default flat: return all categories (no pagination)
    const query = {};
    if (type === "header" || type === "category" || type === "subcategory") {
      query.type = type;
    }
    const categories = await Category.find(query).sort({ order: 1, name: 1 }).lean();
    return handleResponse(
      res,
      200,
      "Categories fetched successfully",
      categories,
    );
  } catch (error) {
    if (error.name === "ValidationError") {
      return handleResponse(res, 400, error.message);
    }
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   CREATE CATEGORY
================================ */
export const createCategory = async (req, res) => {
  try {
    const categoryData = { ...req.body };

    if (!String(categoryData.name || "").trim()) {
      return handleResponse(res, 400, "Name is required");
    }

    if (req.file) {
      categoryData.image = await uploadToCloudinary(
        req.file.buffer,
        "categories",
      );
    }

    categoryData.parentId = normalizeParentId(categoryData.parentId);

    if (!categoryData.type) {
      return handleResponse(res, 400, "Type is required");
    }

    const { ok } = await validateHierarchy({
      res,
      type: categoryData.type,
      parentId: categoryData.parentId,
    });
    if (!ok) return;

    if (!categoryData.slug && categoryData.name) {
      categoryData.slug = categoryData.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      
      const existing = await Category.findOne({ slug: categoryData.slug });
      if (existing) {
        categoryData.slug = `${categoryData.slug}-${Date.now().toString().slice(-4)}`;
      }
    }

    const category = await Category.create(categoryData);
    return handleResponse(res, 201, "Category created successfully", category);
  } catch (error) {
    console.error("Create Category Error:", error);
    if (error.code === 11000) {
      return handleResponse(res, 400, "Slug already exists");
    }
    if (error.name === "ValidationError") {
      return handleResponse(res, 400, error.message);
    }
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE CATEGORY
================================ */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const categoryData = { ...req.body };
    const hasParentId = Object.prototype.hasOwnProperty.call(req.body, "parentId");

    const existing = await Category.findById(id).select("type parentId").lean();
    if (!existing) {
      return handleResponse(res, 404, "Category not found");
    }

    if (req.file) {
      categoryData.image = await uploadToCloudinary(
        req.file.buffer,
        "categories",
      );
    }

    if (hasParentId) {
      categoryData.parentId = normalizeParentId(categoryData.parentId);
    }

    const nextType = categoryData.type || existing.type;
    const nextParentId = hasParentId ? categoryData.parentId : existing.parentId;

    // If switching to header without explicitly sending parentId, force it to null.
    if (nextType === "header" && !hasParentId) {
      categoryData.parentId = null;
    }

    const { ok } = await validateHierarchy({
      res,
      type: nextType,
      parentId: nextParentId,
      currentId: id,
    });
    if (!ok) return;

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { $set: categoryData },
      { new: true, runValidators: true },
    );

    if (!updatedCategory) {
      return handleResponse(res, 404, "Category not found");
    }

    return handleResponse(
      res,
      200,
      "Category updated successfully",
      updatedCategory,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   DELETE CATEGORY
================================ */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Find all descendants recursively might be complex with simple parentId
    // For simplicity, we delete the item. User mentioned "Destroy linked" in frontend.
    // A more robust implementation would delete children too.

    const deleteWithChildren = async (parentId) => {
      const children = await Category.find({ parentId });
      for (const child of children) {
        await deleteWithChildren(child._id);
      }
      await Category.findByIdAndDelete(parentId);
    };

    await deleteWithChildren(id);

    return handleResponse(res, 200, "Category and all descendants deleted");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
