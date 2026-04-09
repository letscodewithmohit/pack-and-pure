import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import Input from "@shared/components/ui/Input";
import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Created", value: "created" },
  { label: "Vendor Confirmed", value: "vendor_confirmed" },
  { label: "Pickup Assigned", value: "pickup_assigned" },
  { label: "Picked", value: "picked" },
  { label: "Exception", value: "exception" },
];

const statusVariant = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "created":
      return "warning";
    case "vendor_confirmed":
      return "info";
    case "pickup_assigned":
      return "primary";
    case "picked":
    case "verified":
      return "success";
    case "exception":
    case "cancelled":
      return "error";
    default:
      return "gray";
  }
};

const normalizeStatus = (status) => String(status || "").trim().toLowerCase();

const canRespond = (row) => {
  const st = normalizeStatus(row?.status);
  const vendorState = normalizeStatus(row?.vendorResponse?.status || "pending");
  if (vendorState !== "pending") return false;
  return ["created", "vendor_confirmed", "pickup_assigned"].includes(st);
};

const canMarkReady = (row) => {
  const st = normalizeStatus(row?.status);
  return ["created", "vendor_confirmed", "pickup_assigned"].includes(st);
};

const ProcurementRequests = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState([]);
  const [otpMap, setOtpMap] = useState({});
  const [notesMap, setNotesMap] = useState({});
  const [savingId, setSavingId] = useState("");

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await sellerApi.getPurchaseRequests({ status });
      const list = res?.data?.result?.items || [];
      setRows(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Failed to load procurement requests:", error);
      showToast("Failed to load procurement requests", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const stats = useMemo(() => {
    const total = rows.length;
    const open = rows.filter((r) =>
      ["created", "vendor_confirmed", "pickup_assigned"].includes(r.status),
    ).length;
    const picked = rows.filter((r) => r.status === "picked").length;
    const exception = rows.filter((r) => r.status === "exception").length;
    return { total, open, picked, exception };
  }, [rows]);

  const act = async (id, fn, successMessage) => {
    try {
      setSavingId(id);
      await fn();
      showToast(successMessage, "success");
      await fetchRows();
    } catch (error) {
      console.error("Procurement action failed:", error);
      showToast(error?.response?.data?.message || "Action failed", "error");
    } finally {
      setSavingId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Procurement Requests</h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Seller flow: accept/reject request, mark ready, and verify pickup OTP handover.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button onClick={fetchRows} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="ring-1 ring-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{stats.total}</p>
        </Card>
        <Card className="ring-1 ring-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Open</p>
          <p className="mt-2 text-2xl font-black text-amber-600">{stats.open}</p>
        </Card>
        <Card className="ring-1 ring-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Picked</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{stats.picked}</p>
        </Card>
        <Card className="ring-1 ring-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Exception</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{stats.exception}</p>
        </Card>
      </div>

      <Card
        title="Assigned Requests"
        subtitle="Only requests mapped to your vendor account are shown here."
        className="ring-1 ring-slate-100"
      >
        {loading ? (
          <p className="text-sm font-semibold text-slate-600">Loading requests...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm font-semibold text-slate-500">No requests found.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div
                key={row._id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {row.requestId}{" "}
                      {row.orderCode ? (
                        <span className="text-slate-500">· Order {row.orderCode}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Hub: {row.hubId} · Updated:{" "}
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleString("en-IN") : "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    <Badge variant={statusVariant(row.vendorResponse?.status)}>
                      {row.vendorResponse?.status || "pending"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {(row.items || []).map((item) => (
                    <div
                      key={`${row._id}-${item.productId}`}
                      className="rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-700"
                    >
                      <p className="font-bold text-slate-900">{item.productName}</p>
                      <p className="mt-1">
                        Required: {item.requiredQty} · Shortage: {item.shortageQty} · Committed:{" "}
                        {item.committedQty || 0}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  <Button
                    isLoading={savingId === `${row._id}:accept`}
                    onClick={() =>
                      act(
                        `${row._id}:accept`,
                        () => sellerApi.respondPurchaseRequest(row._id, { action: "accept" }),
                        "Request accepted",
                      )
                    }
                    disabled={!canRespond(row)}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="danger"
                    isLoading={savingId === `${row._id}:reject`}
                    onClick={() =>
                      act(
                        `${row._id}:reject`,
                        () =>
                          sellerApi.respondPurchaseRequest(row._id, {
                            action: "reject",
                            rejectionReason: notesMap[row._id] || "Rejected by seller",
                          }),
                        "Request rejected",
                      )
                    }
                    disabled={!canRespond(row)}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    isLoading={savingId === `${row._id}:ready`}
                    onClick={() =>
                      act(
                        `${row._id}:ready`,
                        () =>
                          sellerApi.markPurchaseRequestReady(row._id, {
                            notes: notesMap[row._id] || "",
                          }),
                        "Marked ready for pickup",
                      )
                    }
                    disabled={!canMarkReady(row)}
                  >
                    Mark Ready
                  </Button>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <Input
                    value={notesMap[row._id] || ""}
                    onChange={(e) =>
                      setNotesMap((prev) => ({ ...prev, [row._id]: e.target.value }))
                    }
                    placeholder="Notes / rejection reason"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={otpMap[row._id] || ""}
                      onChange={(e) =>
                        setOtpMap((prev) => ({ ...prev, [row._id]: e.target.value }))
                      }
                      placeholder="Pickup OTP"
                    />
                    <Button
                      variant="secondary"
                      isLoading={savingId === `${row._id}:handover`}
                      onClick={() =>
                        act(
                          `${row._id}:handover`,
                          () =>
                            sellerApi.confirmPurchaseHandover(row._id, {
                              otp: otpMap[row._id],
                              notes: notesMap[row._id] || "",
                            }),
                          "Handover OTP verified",
                        )
                      }
                      disabled={row.status !== "pickup_assigned"}
                    >
                      Verify
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProcurementRequests;
