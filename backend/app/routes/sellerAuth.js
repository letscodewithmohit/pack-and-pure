import express from "express";
import { signupSeller, loginSeller } from "../controller/sellerAuthController.js";
import { getSellerProfile, updateSellerProfile, requestWithdrawal, getNearbySellers } from "../controller/sellerController.js";
import { getSellerStats, getSellerEarnings } from "../controller/sellerStatsController.js";
import {
    getSellerPurchaseRequests,
    respondSellerPurchaseRequest,
    markSellerRequestReady,
    confirmSellerHandover,
} from "../controller/purchaseRequestController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", signupSeller);
router.post("/login", loginSeller);
router.get("/nearby", getNearbySellers);

// Profile routes
router.get(
    "/profile",
    verifyToken,
    allowRoles("seller"),
    getSellerProfile
);

router.put(
    "/profile",
    verifyToken,
    allowRoles("seller"),
    updateSellerProfile
);

// Analytics & Financials
router.get("/stats", verifyToken, allowRoles("seller"), getSellerStats);
router.get("/earnings", verifyToken, allowRoles("seller"), getSellerEarnings);
router.post("/request-withdrawal", verifyToken, allowRoles("seller"), requestWithdrawal);

// Procurement / purchase requests (Seller SOP flow)
router.get(
    "/purchase-requests",
    verifyToken,
    allowRoles("seller"),
    getSellerPurchaseRequests,
);
router.post(
    "/purchase-requests/:id/respond",
    verifyToken,
    allowRoles("seller"),
    respondSellerPurchaseRequest,
);
router.post(
    "/purchase-requests/:id/ready",
    verifyToken,
    allowRoles("seller"),
    markSellerRequestReady,
);
router.post(
    "/purchase-requests/:id/handover",
    verifyToken,
    allowRoles("seller"),
    confirmSellerHandover,
);

export default router;
