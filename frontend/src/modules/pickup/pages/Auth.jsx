import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";

const Auth = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) {
      toast.error("10-digit mobile number enter karein");
      return;
    }
    try {
      setLoading(true);
      const res = await pickupApi.sendLoginOtp({ phone });
      toast.success(res?.data?.message || "OTP bhej diya gaya");
      setStep("otp");
    } catch (error) {
      toast.error(error?.response?.data?.message || "OTP send nahi ho paaya");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast.error("OTP enter karein");
      return;
    }
    try {
      setLoading(true);
      const res = await pickupApi.verifyOtp({ phone, otp: otp.trim() });
      const token = res?.data?.result?.token;
      const partner = res?.data?.result?.partner || {};
      if (!token) {
        toast.error("Login response invalid hai");
        return;
      }
      login({
        ...partner,
        token,
        role: "pickup_partner",
      });
      toast.success("Login successful");
      navigate("/pickup/dashboard");
    } catch (error) {
      toast.error(error?.response?.data?.message || "OTP verify nahi ho paaya");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Pickup Partner Login</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vendor to hub assignment handle karne ke liye OTP login karein.
        </p>

        {step === "phone" ? (
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">Mobile Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit number"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">OTP</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter OTP"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOtp("");
                setStep("phone");
              }}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-slate-700"
            >
              Change Number
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;

