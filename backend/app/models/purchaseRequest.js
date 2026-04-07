import mongoose from "mongoose";

const purchaseRequestItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    requiredQty: {
      type: Number,
      required: true,
      min: 1,
    },
    availableQtyAtHub: {
      type: Number,
      default: 0,
      min: 0,
    },
    shortageQty: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false },
);

const purchaseRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    hubId: {
      type: String,
      default: "MAIN_HUB",
      index: true,
    },
    items: {
      type: [purchaseRequestItemSchema],
      default: [],
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      index: true,
    },
    pickupPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PickupPartner",
    },
    status: {
      type: String,
      enum: [
        "created",
        "vendor_confirmed",
        "pickup_assigned",
        "picked",
        "received_at_hub",
        "verified",
        "closed",
        "cancelled",
      ],
      default: "created",
      index: true,
    },
    eta: Date,
    notes: String,
  },
  { timestamps: true },
);

purchaseRequestSchema.index({ orderId: 1, vendorId: 1, createdAt: -1 });

export default mongoose.model("PurchaseRequest", purchaseRequestSchema);
