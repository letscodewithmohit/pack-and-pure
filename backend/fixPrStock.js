import mongoose from "mongoose";
import PurchaseRequest from "./app/models/purchaseRequest.js";
import HubInward from "./app/models/hubInward.js";
import HubInventory from "./app/models/hubInventory.js";
import Product from "./app/models/product.js";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/Quick_commerce";

async function fixPrStock() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const requestId = "PR-1778065934734-737";
    const pr = await PurchaseRequest.findOne({ requestId });
    if (!pr) {
      console.log("PR not found");
      process.exit(1);
    }

    const inward = await HubInward.findOne({ purchaseRequestId: pr._id });
    if (!inward) {
      console.log("Inward record not found");
      process.exit(1);
    }

    console.log(`Fixing stock for PR ${requestId}...`);

    for (const item of inward.receivedItems) {
      const productId = String(item.productId);
      const qty = Number(item.receivedQty || 0); // Use receivedQty since acceptedQty was missing

      if (qty > 0) {
        // 1. Update Hub Inventory
        let hubRow = await HubInventory.findOne({ productId });
        if (hubRow) {
          hubRow.availableQty += qty;
          hubRow.status = "healthy";
          await hubRow.save();
          console.log(`Updated Hub Inventory for ${productId}: +${qty}`);
        } else {
          console.log(`Hub Inventory row not found for ${productId}. Creating one.`);
          await HubInventory.create({
            productId,
            availableQty: qty,
            hubId: "MAIN_HUB",
            status: "healthy"
          });
        }

        // 2. Update Master Product Stock
        const masterProduct = await Product.findById(productId);
        if (masterProduct) {
          masterProduct.stock = (masterProduct.stock || 0) + qty;
          await masterProduct.save();
          console.log(`Updated Master Product stock: ${masterProduct.stock}`);
        }

        // 3. Deduct from Seller Stock (since it wasn't deducted)
        const sellerProduct = await Product.findOne({
          sellerId: pr.vendorId,
          $or: [
            { masterProductId: productId },
            { name: masterProduct?.name } // fallback
          ]
        });

        if (sellerProduct) {
          sellerProduct.stock = Math.max(0, (sellerProduct.stock || 0) - qty);
          await sellerProduct.save();
          console.log(`Deducted ${qty} from Seller Product ${sellerProduct._id}. New stock: ${sellerProduct.stock}`);
        }
      }
    }

    console.log("Stock fix complete!");
    process.exit(0);
  } catch (err) {
    console.error("Fix failed:", err);
    process.exit(1);
  }
}

fixPrStock();
