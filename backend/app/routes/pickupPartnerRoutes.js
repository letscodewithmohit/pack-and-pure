import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  getPickupPartners,
  createPickupPartner,
  updatePickupPartner,
  updatePickupPartnerStatus,
} from "../controller/pickupPartnerController.js";

const router = express.Router();

router.get("/", verifyToken, allowRoles("admin"), getPickupPartners);
router.post("/", verifyToken, allowRoles("admin"), createPickupPartner);
router.put("/:id", verifyToken, allowRoles("admin"), updatePickupPartner);
router.patch("/:id/status", verifyToken, allowRoles("admin"), updatePickupPartnerStatus);

export default router;

