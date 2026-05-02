import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import { adminApi } from "../services/adminApi";
import { useToast } from "@shared/components/ui/Toast";
import { cn } from "@/lib/utils";

const Reports = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getReports({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      setData(res.data?.result || null);
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to load reports", "error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusRows = useMemo(() => {
    const counts = data?.statusCounts || {};
    return Object.entries(counts).map(([k, v]) => ({ key: k, count: Number(v || 0) }));
  }, [data]);

  const paymentRows = useMemo(() => {
    const counts = data?.paymentMethodCounts || {};
    return Object.entries(counts).map(([k, v]) => ({ key: k, count: Number(v || 0) }));
  }, [data]);

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="ds-h1">Reports</h1>
          <p className="ds-description mt-1">Order and payment summaries.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-4 py-2 rounded-2xl bg-white ring-1 ring-slate-200 text-xs font-bold outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              To
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-4 py-2 rounded-2xl bg-white ring-1 ring-slate-200 text-xs font-bold outline-none"
            />
          </div>
          <button
            onClick={fetchReports}
            className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 ring-1 ring-slate-100">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Loading…
          </p>
        </Card>
      ) : !data ? (
        <Card className="p-8 ring-1 ring-slate-100">
          <p className="text-sm font-bold text-slate-600">No data.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                Order Status
              </h3>
              <Badge variant="outline" className="text-[10px] font-black">
                {statusRows.reduce((s, r) => s + r.count, 0)} total
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {statusRows.map((r) => (
                <div
                  key={r.key}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                    {String(r.key).replace(/_/g, " ")}
                  </span>
                  <span className={cn("text-sm font-black", r.count ? "text-slate-900" : "text-slate-400")}>
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                Payment Methods
              </h3>
              <Badge variant="outline" className="text-[10px] font-black">
                {paymentRows.reduce((s, r) => s + r.count, 0)} total
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {paymentRows.map((r) => (
                <div
                  key={r.key}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                    {String(r.key)}
                  </span>
                  <span className={cn("text-sm font-black", r.count ? "text-slate-900" : "text-slate-400")}>
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Reports;

