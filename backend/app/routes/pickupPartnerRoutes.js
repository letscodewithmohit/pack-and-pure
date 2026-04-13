import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  getPickupPartners,
  createPickupPartner,
  updatePickupPartner,
  updatePickupPartnerStatus,
  sendPickupPartnerLoginOtp,
  verifyPickupPartnerOtp,
  getPickupPartnerProfile,
  updatePickupPartnerProfile,
  getMyPickupAssignments,
  markAssignmentPicked,
  markAssignmentHubDelivered,
} from "../controller/pickupPartnerController.js";

const router = express.Router();

router.get("/", verifyToken, allowRoles("admin"), getPickupPartners);
router.post("/", verifyToken, allowRoles("admin"), createPickupPartner);
router.put("/:id", verifyToken, allowRoles("admin"), updatePickupPartner);
router.patch("/:id/status", verifyToken, allowRoles("admin"), updatePickupPartnerStatus);

// Pickup partner app routes
router.post("/send-login-otp", sendPickupPartnerLoginOtp);
router.post("/verify-otp", verifyPickupPartnerOtp);
router.get(
  "/my/profile",
  verifyToken,
  allowRoles("pickup_partner", "admin"),
  getPickupPartnerProfile,
);
router.put(
  "/my/profile",
  verifyToken,
  allowRoles("pickup_partner", "admin"),
  updatePickupPartnerProfile,
);
router.get(
  "/my/assignments",
  verifyToken,
  allowRoles("pickup_partner", "admin"),
  getMyPickupAssignments,
);
router.post(
  "/my/assignments/:id/mark-picked",
  verifyToken,
  allowRoles("pickup_partner", "admin"),
  markAssignmentPicked,
);
router.post(
  "/my/assignments/:id/mark-hub-delivered",
  verifyToken,
  allowRoles("pickup_partner", "admin"),
  markAssignmentHubDelivered,
);

export default router;
