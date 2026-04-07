import mongoose from "mongoose";

const hubInventorySchema = new mongoose.Schema(
  {
    hubId: {
      type: String,
      default: "MAIN_HUB",
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    availableQty: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    reservedQty: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    reorderLevel: {
      type: Number,
      default: 10,
      min: 0,
    },
    status: {
      type: String,
      enum: ["healthy", "low_stock", "out_of_stock"],
      default: "healthy",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "updatedByModel",
    },
    updatedByModel: {
      type: String,
      enum: ["Admin", "Seller", "Delivery", "User"],
    },
  },
  { timestamps: true },
);

hubInventorySchema.index({ hubId: 1, productId: 1 }, { unique: true });

export default mongoose.model("HubInventory", hubInventorySchema);
