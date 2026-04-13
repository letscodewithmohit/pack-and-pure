import express from "express";
import {
  signupDelivery,
  loginDelivery,
  verifyDeliveryOTP,
  getDeliveryProfile,
  updateDeliveryProfile,
} from "../controller/deliveryAuthController.js";
import {
  getDeliveryStats,
  getDeliveryEarnings,
  getMyDeliveryOrders,
  requestWithdrawal,
  updateDeliveryLocation,
  generateDeliveryOtp,
  validateDeliveryOtp,
} from "../controller/deliveryController.js";
import {
  getAvailableOrders,
  acceptOrder,
  updateOrderStatus,
} from "../controller/orderController.js";

import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();
console.log("Delivery Auth Routes Loading...");

router.post(
  "/send-signup-otp",
  upload.fields([
    { name: "aadhar", maxCount: 1 },
    { name: "pan", maxCount: 1 },
    { name: "dl", maxCount: 1 },
  ]),
  signupDelivery,
);
router.post("/send-login-otp", loginDelivery);
router.post("/verify-otp", verifyDeliveryOTP);

// Profile routes
router.get("/profile", verifyToken, getDeliveryProfile);
router.put("/profile", verifyToken, updateDeliveryProfile);
router.get("/stats", verifyToken, getDeliveryStats);
router.get("/earnings", verifyToken, getDeliveryEarnings);
router.get(
  "/order-history",
  verifyToken,
  allowRoles("delivery"),
  getMyDeliveryOrders,
);
router.get(
  "/tasks",
  verifyToken,
  allowRoles("delivery"),
  getAvailableOrders,
);
router.post(
  "/pickup",
  verifyToken,
  allowRoles("delivery"),
  (req, res) => {
    if (!req.body?.orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }
    req.params.orderId = req.body.orderId;
    return acceptOrder(req, res);
  },
);
router.post(
  "/complete",
  verifyToken,
  allowRoles("delivery"),
  (req, res) => {
    if (!req.body?.orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }
    req.params.orderId = req.body.orderId;
    req.body.status = "delivered";
    return updateOrderStatus(req, res);
  },
);
router.post("/request-withdrawal", verifyToken, requestWithdrawal);
router.post("/location", verifyToken, updateDeliveryLocation);

// OTP generation for delivery completion
router.post(
  "/orders/:orderId/generate-otp",
  verifyToken,
  allowRoles("delivery"),
  generateDeliveryOtp
);

// OTP validation for delivery completion
router.post(
  "/orders/:orderId/validate-otp",
  verifyToken,
  allowRoles("delivery"),
  validateDeliveryOtp
);

export default router;
