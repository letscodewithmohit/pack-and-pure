import React, { useEffect, useMemo, useState } from "react";
import { 
  FileClock, 
  ArrowRight, 
  CheckCircle2, 
  Truck, 
  Store, 
  PackageCheck, 
  AlertCircle,
  Clock
} from "lucide-react";
import SupplyModuleTable from "../components/supply/SupplyModuleTable";
import {
  SupplyConfirmModal,
  SupplyFormModal,
  SupplyInfoModal,
} from "../components/supply/SupplyActionModals";
import { adminApi } from "../services/adminApi";
import { motion, AnimatePresence } from "framer-motion";

const labelToStatus = (value) => {
  const v = String(value || "").trim();
  if (!v) return "created";
  const map = {
    Pending: "created",
    Assigned: "pickup_assigned",
    "In Transit": "picked",
    Cancelled: "cancelled",
    Verified: "verified",
    "Received at Hub": "received_at_hub"
  };
  return map[v] || v.toLowerCase().replace(/\s+/g, "_");
};

const statusToLabel = (value) => {
  const map = {
    created: "Pending",
    vendor_confirmed: "Vendor Confirmed",
    pickup_assigned: "Assigned",
    picked: "In Transit",
    hub_delivered: "At Hub Gate",
    received_at_hub: "Received at Hub",
    verified: "Verified & Stocked",
    closed: "Closed",
    cancelled: "Cancelled",
    exception: "Exception",
  };
  return map[value] || value;
};

const PurchaseRequestsPage = () => {
  const [rows, setRows] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [pickupPartners, setPickupPartners] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);
  const [assignForm, setAssignForm] = useState({ pickupPartnerId: "" });
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState({ vendorId: "" });
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  const fetchRows = async () => {
    try {
      const res = await adminApi.getPurchaseRequests({ page: 1, limit: 200 });
      const payload = res?.data?.result || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      setRows(
        items.map((item) => ({
          ...item,
          statusLabel: statusToLabel(item.status),
          rawStatus: item.status,
          quantity: Number(item.quantity || 0),
        })),
      );
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    fetchRows();
    (async () => {
      try {
        const res = await adminApi.getSellers({ page: 1, limit: 300 });
        const items = res?.data?.result?.items || res?.data?.result || [];
        setSellers(Array.isArray(items) ? items : []);
      } catch {
        setSellers([]);
      }
    })();
    (async () => {
      try {
        const res = await adminApi.getPickupPartners({ page: 1, limit: 300 });
        const items = res?.data?.result?.items || res?.data?.result || [];
        setPickupPartners(Array.isArray(items) ? items : []);
      } catch {
        setPickupPartners([]);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchRows();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const openAssign = (row) => {
    setCurrentRow(row);
    // Initialize with first partner if available
    setAssignForm({ pickupPartnerId: pickupPartners[0]?._id || "" });
    setAssignOpen(true);
  };

  const submitAssign = async () => {
    if (!currentRow) return;
    const pickupPartnerId = String(assignForm.pickupPartnerId || "").trim();
    if (!pickupPartnerId) {
      toast.error("Please select a pickup partner.");
      return;
    }
    try {
      const res = await adminApi.assignPurchasePickupPartner(currentRow._id, { pickupPartnerId });
      const otp = res?.data?.result?.pickupOtp;
      setAssignOpen(false);
      setInfoMessage(`Pickup Assigned. Share this OTP with Partner for verification: ${otp || 'N/A'}`);
      setInfoOpen(true);
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign partner");
    }
  };

  const openAssignVendor = (row) => {
    setCurrentRow(row);
    // Initialize with first seller id if available
    setVendorForm({ vendorId: sellers[0]?._id || "" });
    setVendorOpen(true);
  };

  const submitAssignVendor = async () => {
    if (!currentRow?._id) return;
    const vendorId = String(vendorForm.vendorId || "").trim();
    if (!vendorId) {
      toast.error("Select a vendor");
      return;
    }
    try {
      await adminApi.assignPurchaseVendor(currentRow._id, { vendorId });
      const vendorName = sellers.find(s => s._id === vendorId)?.shopName || vendorId;
      setVendorOpen(false);
      setInfoMessage(`Vendor "${vendorName}" assigned successfully. The request has been moved to procurement.`);
      setInfoOpen(true);
      fetchRows();
    } catch (err) {
      toast.error("Vendor assignment failed");
    }
  };

  const markReceivedAtHub = async (row) => {
    try {
      await adminApi.receivePurchaseRequestAtHub(row._id, {});
      setInfoMessage(`Gate Pass Verified. Item ${row.requestId} is now inside the Hub.`);
      setInfoOpen(true);
      fetchRows();
    } catch (err) {
      toast.error("Inward failed");
    }
  };

  const markVerified = async (row) => {
    try {
      await adminApi.verifyPurchaseRequestInward(row._id, { verified: true });
      setInfoMessage(`Verification Success. Stock for ${row.product} has been added to Hub Inventory.`);
      setInfoOpen(true);
      fetchRows();
    } catch (err) {
      toast.error("Verification and stock update failed");
    }
  };

  const stats = useMemo(() => {
    const total = rows.length;
    const stocked = rows.filter(r => r.rawStatus === 'verified').length;
    return [
      { label: "Total Requests", value: String(total) },
      { label: "Awaiting Action", value: String(rows.filter(r => r.rawStatus === 'created').length) },
      { label: "In-Transit", value: String(rows.filter(r => r.rawStatus === 'picked' || r.rawStatus === 'pickup_assigned').length) },
      { label: "Stocked", value: String(stocked) },
    ];
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <FileClock size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none mb-1">Inward Command Center</h1>
            <p className="text-xs text-slate-400 font-medium">Manage end-to-end product lifecycle from Vendor to Hub Inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="h-10 w-[1px] bg-slate-100 hidden md:block" />
            <div className="flex -space-x-2">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-8 w-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-400">
                        {i + 1}
                    </div>
                ))}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 hidden md:block">Active Pipeline Flow</p>
        </div>
      </div>

      <SupplyModuleTable
        title="Purchase Requests"
        subtitle="Operational Timeline"
        icon={FileClock}
        stats={stats}
        columns={[
          { key: "requestId", label: "Request ID" },
          { key: "vendorName", label: "Vendor" },
          { key: "product", label: "Product & Spec" },
          { key: "quantity", label: "Qty" },
          { key: "statusLabel", label: "Inventory Stage" },
        ]}
        rows={rows}
        statusColumn="statusLabel"
        renderActions={(row) => {
          const st = row.rawStatus;
          const isTerminal = ["verified", "closed", "cancelled"].includes(st);
          const needsVendor = !row.vendorId && !isTerminal;
          const needsPickup = (st === "created" || st === "vendor_confirmed") && row.vendorId;
          const needsReceive = ["pickup_assigned", "picked", "hub_delivered"].includes(st);
          const needsFinalVerify = st === "received_at_hub";

          return (
            <div className="flex items-center gap-2">
              {needsVendor && (
                <button
                  onClick={() => openAssignVendor(row)}
                  className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all"
                >
                  <Store size={14} /> Assign Vendor
                </button>
              )}

              {needsPickup && (
                <button
                  onClick={() => openAssign(row)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                >
                  <Truck size={14} /> Assign Pickup
                </button>
              )}

              {needsReceive && (
                <button
                  onClick={() => markReceivedAtHub(row)}
                  className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-700 shadow-lg shadow-sky-200 transition-all"
                >
                  <PackageCheck size={14} /> Mark Received
                </button>
              )}

              {needsFinalVerify && (
                <button
                  onClick={() => markVerified(row)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200 animate-pulse transition-all"
                >
                  <CheckCircle2 size={14} /> Verify & Stock Add
                </button>
              )}

              {!isTerminal && (
                <button
                  onClick={() => { setCurrentRow(row); setCancelOpen(true); }}
                  className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <AlertCircle size={18} />
                </button>
              )}
            </div>
          );
        }}
      />

      {/* Modals remain mostly similar but with better styling context */}
      <SupplyFormModal
        isOpen={vendorOpen}
        onClose={() => setVendorOpen(false)}
        title="Assign Merchant Partner"
        submitLabel="Confirm Assignment"
        fields={[
          {
            key: "vendorId",
            label: "Available Vendors",
            type: "select",
            options: [
              { value: "", label: "Select a Vendor..." },
              ...sellers.map((s) => ({
                value: s._id,
                label: `${s.shopName || s.name} (${s.email})`,
              }))
            ],
          },
        ]}
        values={vendorForm}
        onChange={(k, v) => setVendorForm(prev => ({ ...prev, [k]: v }))}
        onSubmit={submitAssignVendor}
      />

      <SupplyFormModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Select Pickup Partner"
        submitLabel="Assign Partner"
        fields={[
          {
            key: "pickupPartnerId",
            label: "Nearby Partners",
            type: "select",
            options: [
              { value: "", label: "Select a Partner..." },
              ...pickupPartners.map((p) => ({
                value: p._id,
                label: `${p.partnerName || p.name} - ${p.phone}`,
              }))
            ],
          },
        ]}
        values={assignForm}
        onChange={(k, v) => setAssignForm(prev => ({ ...prev, [k]: v }))}
        onSubmit={submitAssign}
      />

      <SupplyConfirmModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Request Cancellation"
        message={`Warning: Cancelling request ${currentRow?.requestId} will stop the inward process. Continue?`}
        confirmLabel="Yes, Cancel"
        onConfirm={async () => {
            await adminApi.updatePurchaseRequestStatus(currentRow._id, "cancelled");
            setCancelOpen(false);
            fetchRows();
        }}
      />

      <SupplyInfoModal
        isOpen={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Operation Status"
        message={infoMessage}
      />
    </div>
  );
};

export default PurchaseRequestsPage;

