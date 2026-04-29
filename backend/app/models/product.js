import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        sku: {
            type: String,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        salePrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        purchasePrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        stock: {
            type: Number,
            required: true,
            default: 0,
        },
        lowStockAlert: {
            type: Number,
            default: 5,
        },
        brand: {
            type: String,
            trim: true,
        },
        weight: {
            type: String,
            trim: true,
        },
        unit: {
            type: String,
            enum: ["Pieces", "kg", "g", "L", "ml", "Pack", "Box", "Bundle"],
            default: "Pieces",
        },
        tags: [{
            type: String,
            trim: true,
        }],
        mainImage: {
            type: String, // Cloudinary URL
        },
        galleryImages: [{
            type: String, // Array of Cloudinary URLs
        }],
        headerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        subcategoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        ownerType: {
            type: String,
            enum: ["seller", "admin"],
            default: "seller",
        },
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            default: null,
            required: function () {
                return this.ownerType !== "admin";
            },
        },
        status: {
            type: String,
            enum: ["pending_approval", "active", "inactive", "rejected"],
            default: "pending_approval",
        },
        variants: [
            {
                name: String,
                price: Number,
                salePrice: Number,
                stock: Number,
                sku: String,
            }
        ],
        isFeatured: {
            type: Boolean,
            default: false,
        },
        masterProductId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            default: null,
            // Only applicable if ownerType is 'seller'
        }
    },
    { timestamps: true }
);

// Optimize performance for common queries on home/search pages
productSchema.index({ status: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ headerId: 1, status: 1 });
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ subcategoryId: 1, status: 1 });
productSchema.index({ sellerId: 1, status: 1 });
productSchema.index({ ownerType: 1, status: 1, createdAt: -1 });
productSchema.index({ name: "text", tags: "text" }); // For better search if regex is too slow

export default mongoose.model("Product", productSchema);
