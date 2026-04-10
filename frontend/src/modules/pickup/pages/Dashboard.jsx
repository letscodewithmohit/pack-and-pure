import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@core/context/AuthContext";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation supported nahi hai"));
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
      toast.error(error?.response?.data?.message || "Assignments load nahi huye");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    const timer = setInterval(() => {
      fetchAssignments();
    }, 10000);
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

  const listStats = useMemo(() => {
    const assigned = rows.filter((r) => r.status === "pickup_assigned").length;
    const picked = rows.filter((r) => r.status === "picked").length;
    const hubDelivered = rows.filter((r) => r.status === "hub_delivered").length;
    return { assigned, picked, hubDelivered };
  }, [rows]);

  const onMarkPicked = async (row) => {
    const otp = String(otpById[row._id] || "").trim();
    if (!otp) {
      toast.error("Pickup OTP enter karein");
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
      toast.success(`Request ${row.requestId} pickup mark ho gaya`);
      await fetchAssignments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Pickup mark nahi ho paaya");
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
      toast.success(`Request ${row.requestId} hub delivered mark ho gaya`);
      await fetchAssignments();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Hub delivery mark nahi ho paayi");
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pickup Dashboard</h1>
            <p className="text-sm text-slate-500">
              {user?.name || "Partner"} | {user?.phone || "-"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="all">All</option>
              <option value="pickup_assigned">Pickup Assigned</option>
              <option value="picked">Picked</option>
              <option value="hub_delivered">Hub Delivered</option>
            </select>
            <button
              type="button"
              onClick={fetchAssignments}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Assigned</p>
            <p className="text-2xl font-bold text-slate-900">{listStats.assigned}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Picked</p>
            <p className="text-2xl font-bold text-slate-900">{listStats.picked}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Hub Delivered</p>
            <p className="text-2xl font-bold text-slate-900">{listStats.hubDelivered}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Request</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Products</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                      Loading assignments...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                      Koi assignment nahi mila.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row._id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3 text-sm text-slate-900">
                        <p className="font-semibold">{row.requestId}</p>
                        <p className="text-xs text-slate-500">Order: {row.orderId || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        <p>{row.vendor?.name || "Vendor"}</p>
                        <p className="text-xs text-slate-500">{row.vendor?.phone || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {(row.products || []).map((p) => (
                          <p key={`${row._id}-${p.productId || p.name}`}>
                            {p.name} x {p.qty}
                          </p>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.status === "pickup_assigned" ? (
                          <div className="space-y-2">
                            {row.pickupOtp ? (
                              <p className="text-xs font-semibold text-slate-600">
                                Assigned OTP: {row.pickupOtp}
                              </p>
                            ) : null}
                            <input
                              type="text"
                              placeholder="Pickup OTP"
                              value={otpById[row._id] || ""}
                              onChange={(e) =>
                                setOtpById((prev) => ({
                                  ...prev,
                                  [row._id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                                }))
                              }
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => onMarkPicked(row)}
                              disabled={actionLoadingId === row._id}
                              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              {actionLoadingId === row._id ? "Saving..." : "Mark Picked"}
                            </button>
                          </div>
                        ) : row.status === "picked" ? (
                          <button
                            type="button"
                            onClick={() => onMarkHubDelivered(row)}
                            disabled={actionLoadingId === row._id}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {actionLoadingId === row._id
                              ? "Saving..."
                              : "Mark Hub Delivered"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">No action</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
