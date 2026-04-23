import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import handleResponse from "../utils/helper.js";

/* ===============================
   Verify Token
================================ */
export const verifyToken = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return handleResponse(res, 401, "Unauthorized, token missing");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Strict existence check: Ensure user still exists in DB
    const { id, role } = decoded;
    let exists = false;
    if (role === 'admin') exists = await mongoose.model('Admin').exists({ _id: id });
    else if (role === 'seller') exists = await mongoose.model('Seller').exists({ _id: id });
    else if (role === 'delivery') exists = await mongoose.model('Delivery').exists({ _id: id });
    else if (role === 'pickup_partner') exists = await mongoose.model('PickupPartner').exists({ _id: id });
    else if (role === 'user' || role === 'customer') exists = await mongoose.model('User').exists({ _id: id });

    if (!exists) {
      return handleResponse(res, 401, "Account no longer exists. Please login again.");
    }

    req.user = decoded; // { id, role }
    next();

  } catch (error) {
    return handleResponse(res, 401, "Invalid or expired token");
  }
};

/* ===============================
   Role Based Access
================================ */
export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return handleResponse(res, 403, "Access denied");
    }
    next();
  };
};

/* ===============================
   Verification Check
================================ */
export const isAccountVerified = async (req, res, next) => {
  try {
    const { id, role } = req.user;
    let modelName = "";

    if (role === "seller") modelName = "Seller";
    else if (role === "delivery") modelName = "Delivery";
    else if (role === "pickup_partner") modelName = "PickupPartner";
    else return next(); // Customers/Admins don't need this check here or have different flows

    const Model = mongoose.model(modelName);
    const account = await Model.findById(id).select("isVerified").lean();

    if (!account || !account.isVerified) {
      return handleResponse(
        res,
        403,
        "Access Denied: Your account is pending admin approval. You can login but cannot perform operational tasks yet."
      );
    }

    next();
  } catch (error) {
    return handleResponse(res, 500, "Verification check failed");
  }
};