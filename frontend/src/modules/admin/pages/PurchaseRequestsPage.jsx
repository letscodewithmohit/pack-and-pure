import React, { useEffect, useMemo, useState } from "react";
import { FileClock } from "lucide-react";
import SupplyModuleTable from "../components/supply/SupplyModuleTable";
import {
  SupplyConfirmModal,
  SupplyFormModal,
  SupplyInfoModal,
} from "../components/supply/SupplyActionModals";
import { adminApi } from "../services/adminApi";

const labelToStatus = (value) => {
  const v = String(value || "").trim();
  if (!v) return "created";
  const map = {
    Pending: "created",
    Assigned: "pickup_assigned",
    "In Transit": "picked",
    Cancelled: "cancelled",
    Verified: "verified",
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
    verified: "Verified",
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
          status: statusToLabel(item.status),
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
        const payload = res?.data?.result || {};
        const items = Array.isArray(payload.items) ? payload.items : [];
        setSellers(items);
      } catch {
        setSellers([]);
      }
    })();
    (async () => {
      try {
        const res = await adminApi.getPickupPartners({ page: 1, limit: 300 });
        const payload = res?.data?.result || {};
        const items = Array.isArray(payload.items) ? payload.items : [];
        setPickupPartners(items);
      } catch {
        setPickupPartners([]);
      }
    })();
  }, []);

  const openAssign = (row) => {
    const firstPartnerId =
      pickupPartners.length > 0 ? String(pickupPartners[0]?._id || "") : "";
    setCurrentRow(row);
    setAssignForm({ pickupPartnerId: firstPartnerId });
    setAssignOpen(true);
  };

  const submitAssign = async () => {
    if (!currentRow) return;
    const pickupPartnerId = String(assignForm.pickupPartnerId || "").trim();
    if (!pickupPartnerId) {
      setInfoMessage("Pickup partner select karo ya pehle Pickup Partner add karo.");
      setInfoOpen(true);
      return;
    }

    try {
      await adminApi.assignPurchasePickupPartner(currentRow._id, {
        pickupPartnerId,
      });

      setAssignOpen(false);
      setInfoMessage(`Pickup partner assigned successfully.`);
      setInfoOpen(true);
      await fetchRows();
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        "Assign pickup failed. Please retry.";
      setInfoMessage(msg);
      setInfoOpen(true);
    }
  };

  const openCancel = (row) => {
    setCurrentRow(row);
    setCancelOpen(true);
  };

  const openAssignVendor = (row) => {
    setCurrentRow(row);
    setVendorForm({ vendorId: "" });
    setVendorOpen(true);
  };

  const submitAssignVendor = async () => {
    if (!currentRow?._id) return;
    const vendorId = String(vendorForm.vendorId || "").trim();
    if (!vendorId) return;
    await adminApi.assignPurchaseVendor(currentRow._id, { vendorId });
    setVendorOpen(false);
    setInfoMessage(`Vendor assigned for request ${currentRow.requestId}.`);
    setInfoOpen(true);
    await fetchRows();
  };

  const confirmCancel = async () => {
    if (!currentRow) return;
    await adminApi.updatePurchaseRequestStatus(currentRow._id, "cancelled");
    setCancelOpen(false);
    await fetchRows();
  };

  const markReceivedAtHub = async (row) => {
    await adminApi.receivePurchaseRequestAtHub(row._id, {});
    setInfoMessage(`Request ${row.requestId} marked as received at hub.`);
    setInfoOpen(true);
    await fetchRows();
  };

  const markVerified = async (row) => {
    await adminApi.verifyPurchaseRequestInward(row._id, { verified: true });
    setInfoMessage(`Request ${row.requestId} verified successfully.`);
    setInfoOpen(true);
    await fetchRows();
  };

  const stats = useMemo(() => {
    const pending = rows.filter((item) => labelToStatus(item.status) === "created").length;
    const assigned = rows.filter((item) => {
      const st = labelToStatus(item.status);
      return st === "pickup_assigned" || st === "picked";
    }).length;
    const verified = rows.filter((item) => labelToStatus(item.status) === "verified").length;
    const cancelled = rows.filter((item) => labelToStatus(item.status) === "cancelled").length;

    return [
      { label: "Open Requests", value: String(rows.length) },
      { label: "Awaiting Pickup", value: String(pending) },
      { label: "Assigned/In Transit", value: String(assigned) },
      { label: "Verified", value: String(verified) },
      { label: "Cancelled", value: String(cancelled) },
    ];
  }, [rows]);

  return (
    <>
      <SupplyModuleTable
        title="Purchase Requests"
        subtitle="SOP lifecycle: created -> pickup_assigned -> picked -> received_at_hub -> verified"
        icon={FileClock}
        stats={stats}
        columns={[
          { key: "requestId", label: "Request ID" },
          { key: "vendorName", label: "Vendor Name" },
          { key: "product", label: "Product" },
          { key: "quantity", label: "Quantity" },
          { key: "status", label: "Status" },
        ]}
        rows={rows}
        statusColumn="status"
        renderActions={(row) => (
          <>
            {!row.vendorId ? (
              <button
                type="button"
                onClick={() => openAssignVendor(row)}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                Assign Vendor
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openAssign(row)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Assign Pickup
            </button>
            <button
              type="button"
              onClick={() => markReceivedAtHub(row)}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">
              Receive at Hub
            </button>
            <button
              type="button"
              onClick={() => markVerified(row)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              Verify
            </button>
            <button
              type="button"
              onClick={() => openCancel(row)}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">
              Cancel
            </button>
          </>
        )}
      />

      <SupplyFormModal
        isOpen={vendorOpen}
        onClose={() => setVendorOpen(false)}
        title={`Assign Vendor${currentRow ? ` - ${currentRow.requestId}` : ""}`}
        submitLabel="Assign Vendor"
        fields={[
          {
            key: "vendorId",
            label: "Vendor",
            type: "select",
            options: sellers.map((s) => ({
              value: s._id,
              label: s.shopName || s.name || s.email || s._id,
            })),
          },
        ]}
        values={vendorForm}
        onChange={(key, value) => setVendorForm((prev) => ({ ...prev, [key]: value }))}
        onSubmit={submitAssignVendor}
      />

      <SupplyFormModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={`Assign Pickup Partner${currentRow ? ` - ${currentRow.requestId}` : ""}`}
        submitLabel="Assign"
        fields={[
          {
            key: "pickupPartnerId",
            label: "Pickup Partner",
            type: "select",
            options: pickupPartners.map((p) => ({
              value: p._id,
              label: `${p.partnerName || p.name} (${p.phone || "N/A"})`,
            })),
          },
        ]}
        values={assignForm}
        onChange={(key, value) => setAssignForm((prev) => ({ ...prev, [key]: value }))}
        onSubmit={submitAssign}
      />

      <SupplyConfirmModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel Request"
        message={currentRow ? `Cancel request ${currentRow.requestId}?` : "Cancel this request?"}
        confirmLabel="Cancel Request"
        onConfirm={confirmCancel}
      />

      <SupplyInfoModal
        isOpen={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Purchase Request"
        message={infoMessage}
      />
    </>
  );
};

export default PurchaseRequestsPage;
