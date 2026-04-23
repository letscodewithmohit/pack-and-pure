import express from "express";
import {
    getProducts,
    getSellerProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductById
} from "../controller/productController.js";
import { adjustStock, getStockHistory } from "../controller/stockController.js";
import { verifyToken, allowRoles, isAccountVerified } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Admin protected listing (bypass customer lat/lng visibility constraint)
router.get("/admin/list", verifyToken, allowRoles("admin"), getProducts);

// Public routes
router.get("/", getProducts);

// Seller protected routes
router.get("/seller/me", verifyToken, allowRoles("seller"), getSellerProducts);
router.get("/:id", getProductById);

router.post(
    "/",
    verifyToken,
    allowRoles("seller", "admin"),
    isAccountVerified,
    upload.fields([
        { name: 'mainImage', maxCount: 1 },
        { name: 'galleryImages', maxCount: 5 }
    ]),
    createProduct
);

router.put(
    "/:id",
    verifyToken,
    allowRoles("seller", "admin"),
    isAccountVerified,
    upload.fields([
        { name: 'mainImage', maxCount: 1 },
        { name: 'galleryImages', maxCount: 5 },
        { name: 'images', maxCount: 5 } // For admin compatibility
    ]),
    updateProduct
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles("seller", "admin"),
    isAccountVerified,
    deleteProduct
);

// Stock Management
router.post("/adjust-stock", verifyToken, allowRoles("seller"), isAccountVerified, adjustStock);
router.get("/stock-history", verifyToken, allowRoles("seller"), isAccountVerified, getStockHistory);

export default router;
