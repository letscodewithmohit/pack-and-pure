import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    label: {
        type: String,
        enum: ["home", "work", "other"],
        default: "home",
    },
    fullAddress: {
        type: String,
        required: true,
    },
    landmark: String,
    city: String,
    state: String,
    pincode: String,
    location: {
        lat: Number,
        lng: Number,
    },
});

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
        },
        businessName: {
            type: String,
            trim: true,
        },
        contactPerson: {
            type: String,
            trim: true,
        },

        email: {
            type: String,
            lowercase: true,
            unique: true,
            sparse: true, // phone login users ke liye
        },

        phone: {
            type: String,
            required: true,
            unique: true,
        },

        password: {
            type: String,
            select: false, // response me password na aaye
        },

        role: {
            type: String,
            enum: ["user", "customer", "admin", "delivery", "seller"],
            default: "customer",
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        otp: {
            type: String,
            select: false,
        },

        otpExpiry: {
            type: Date,
            select: false,
        },

        addresses: [addressSchema],

        walletBalance: {
            type: Number,
            default: 0,
        },
        codCancelCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        codBlocked: {
            type: Boolean,
            default: false,
        },
        codBlockedAt: {
            type: Date,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        lastLogin: Date,
    },
    {
        timestamps: true,
    }
);

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ codBlocked: 1, codCancelCount: 1 });

export default mongoose.model("User", userSchema);
