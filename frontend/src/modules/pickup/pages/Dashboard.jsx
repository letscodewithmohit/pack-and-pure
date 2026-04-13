import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@core/context/AuthContext";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";
import { 
  Package, 
  MapPin, 
  CheckCircle, 
  Truck, 
  LogOut, 
  RefreshCw, 
  Clock, 
  Store,
  ChevronRight,
  Navigation,
  KeyRound
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState("active");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [otpById, setOtpById] = useState({});

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await pickupApi.getAssignments({ status: statusFilter });
      const items = res?.data?.result?.items || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load assignments");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    const timer = setInterval(() => {
      fetchAssignments();
    }, 15000);
    return () => clearInterval(timer);
  }, [statusFilter]);

  useEffect(() => {
    setOtpById((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row._id] && row.pickupOtp) {
          next[row._id] = String(row.pickupOtp);
        }
      }
      return next;
    });
  }, [rows]);

  const stats = useMemo(() => {
    const assigned = rows.filter((r) => r.status === "pickup_assigned").length;
    const picked = rows.filter((r) => r.status === "picked").length;
    const delivered = rows.filter((r) => r.status === "hub_delivered").length;
    return [
      { label: "Assigned", value: assigned, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Picked", value: picked, icon: Package, color: "text-sky-600", bg: "bg-sky-50" },
      { label: "Done", value: delivered, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    ];
  }, [rows]);

  const onMarkPicked = async (row) => {
    const otp = String(otpById[row._id] || "").trim();
    if (!otp) {
      toast.error("Please enter the Pickup OTP");
      return;
    }

    try {
      setActionLoadingId(row._id);
      const coords = await getCurrentPosition();
      await pickupApi.markPicked(row._id, {
        otp,
        lat: coords.latitude,
        lng: coords.longitude,
      });
      toast.success(`Items picked successfully from ${row.vendor?.shopName || "Vendor"}`);
      await fetchAssignments();
    } catch (error) {
      const msg = error?.response?.data?.message || "Verification failed";
      toast.error(msg, {
        description: msg.includes("far") ? "Please ensure you are at the vendor's shop location." : ""
      });
    } finally {
      setActionLoadingId("");
    }
  };

  const onMarkHubDelivered = async (row) => {
    try {
      setActionLoadingId(row._id);
      const coords = await getCurrentPosition();
      await pickupApi.markHubDelivered(row._id, {
        lat: coords.latitude,
        lng: coords.longitude,
      });
      toast.success("Assignment delivered to hub");
      await fetchAssignments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Hub delivery failed");
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Premium Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Truck size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Pickup Center</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                {user?.name || "Partner"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchAssignments}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button 
              onClick={logout}
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={stat.label}
              className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center"
            >
              <div className={`${stat.bg} ${stat.color} p-2 rounded-xl mb-1`}>
                <stat.icon size={16} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
              <span className="text-xl font-black text-slate-900 leading-none">{stat.value}</span>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {["active", "pickup_assigned", "picked", "hub_delivered", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                statusFilter === f 
                  ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {f.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {loading && rows.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="h-10 w-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-400 uppercase">Fetching Tasks...</p>
              </div>
            ) : rows.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300"
              >
                <Package className="mx-auto text-slate-200 mb-2" size={48} />
                <p className="text-sm font-bold text-slate-400 uppercase">No Tasks Available</p>
              </motion.div>
            ) : (
              rows.map((row) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={row._id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Row: Request ID & Status */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                          {row.status.replace("_", " ")}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          #{row.requestId}
                          <ChevronRight size={14} className="text-slate-300" />
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned At</p>
                        <p className="text-xs font-bold text-slate-700">
                          {new Date(row.updatedAt || row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Vendor Card */}
                    <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                          <Store size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{row.vendor?.shopName || "Harsh's Hub"}</p>
                          <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <MapPin size={10} /> Location Verified
                          </p>
                        </div>
                      </div>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${row.vendor?.shopName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-8 w-8 bg-sky-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-sky-200 hover:bg-sky-600 transition-all"
                      >
                        <Navigation size={14} />
                      </a>
                    </div>

                    {/* Products List */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items to Pickup</h4>
                      <div className="space-y-1.5">
                        {(row.products || []).map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-700">{p.name || "Product Item"}</p>
                            <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">x{p.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions Area */}
                    <div className="pt-2 border-t border-slate-100">
                      {row.status === "pickup_assigned" ? (
                        <div className="space-y-3">
                          <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                              type="text"
                              placeholder="ENTER HANDOVER OTP"
                              value={otpById[row._id] || ""}
                              onChange={(e) =>
                                setOtpById((prev) => ({
                                  ...prev,
                                  [row._id]: e.target.value.replace(/\D/g, "").slice(0, 4),
                                }))
                              }
                              className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-black text-slate-900 placeholder:text-slate-300 placeholder:font-bold focus:ring-2 focus:ring-slate-900 transition-all tracking-[0.5em]"
                            />
                            {row.pickupOtp && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                                YOUR OTP: {row.pickupOtp}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onMarkPicked(row)}
                            disabled={actionLoadingId === row._id}
                            className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {actionLoadingId === row._id ? "Verifying..." : "CONFIRM PICKUP"}
                          </button>
                        </div>
                      ) : row.status === "picked" ? (
                        <button
                          type="button"
                          onClick={() => onMarkHubDelivered(row)}
                          disabled={actionLoadingId === row._id}
                          className="w-full bg-emerald-600 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {actionLoadingId === row._id ? (
                            "Processing..."
                          ) : (
                            <>
                              <CheckCircle size={14} />
                              COMPLETE HUB DELIVERY
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="bg-slate-50 p-3 rounded-2xl text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                            <CheckCircle size={12} className="text-emerald-500" />
                            Assignment Completed
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
