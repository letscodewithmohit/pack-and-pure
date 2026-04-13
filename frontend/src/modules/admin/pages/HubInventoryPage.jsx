import React, { useEffect, useMemo, useState } from "react";
import { Boxes, ImagePlus } from "lucide-react";
import Modal from "@shared/components/ui/Modal";
import SupplyModuleTable from "../components/supply/SupplyModuleTable";
import { SupplyFormModal } from "../components/supply/SupplyActionModals";
import { adminApi } from "../services/adminApi";

const statusText = (value) => {
  const v = String(value || "").toLowerCase();
  if (v === "low_stock") return "Low Stock";
  if (v === "out_of_stock") return "Out of Stock";
  return "Healthy";
};

const HubInventoryPage = () => {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    productId: "",
    hubStockQuantity: "0",
    minimumStockAlert: "10",
  });

  const [stockOpen, setStockOpen] = useState(false);
  const [stockRow, setStockRow] = useState(null);
  const [stockDelta, setStockDelta] = useState("10");

  const [minOpen, setMinOpen] = useState(false);
  const [minRow, setMinRow] = useState(null);
  const [minValue, setMinValue] = useState("0");

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getHubInventory();
      const payload = res.data?.result || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      setRows(items);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await adminApi.getProducts({ page: 1, limit: 300, status: "active", ownerType: "admin" });
      const payload = res.data?.result || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      setProducts(items);
      if (!addForm.productId && items[0]?._id) {
        setAddForm((prev) => ({ ...prev, productId: items[0]._id }));
      }
    } catch {
      setProducts([]);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchProducts();
  }, []);

  const openAddModal = () => {
    setAddForm((prev) => ({
      productId: prev.productId || products[0]?._id || "",
      hubStockQuantity: "0",
      minimumStockAlert: "10",
    }));
    setAddOpen(true);
  };

  const selectedProduct = useMemo(
    () => products.find((p) => p._id === addForm.productId) || null,
    [products, addForm.productId],
  );

  const submitAdd = async () => {
    if (!addForm.productId) return;
    const qty = Math.max(0, Number(addForm.hubStockQuantity || 0));
    const minAlert = Math.max(0, Number(addForm.minimumStockAlert || 0));

    await adminApi.upsertHubInventory({
      productId: addForm.productId,
      quantity: qty,
      minimumStockAlert: minAlert,
    });

    setAddOpen(false);
    await fetchInventory();
  };

  const openStockModal = (row) => {
    setStockRow(row);
    setStockDelta("10");
    setStockOpen(true);
  };

  const submitStock = async () => {
    if (!stockRow?._id) return;
    const delta = Number(stockDelta || 0);
    if (!Number.isFinite(delta) || delta === 0) return;
    await adminApi.adjustHubInventoryStock(stockRow._id, delta);
    setStockOpen(false);
    await fetchInventory();
  };

  const openMinModal = (row) => {
    setMinRow(row);
    setMinValue(String(row.minimumStockAlert || 0));
    setMinOpen(true);
  };

  const submitMin = async () => {
    if (!minRow?._id) return;
    const nextMin = Math.max(0, Number(minValue || 0));
    await adminApi.updateHubInventoryReorderLevel(minRow._id, nextMin);
    setMinOpen(false);
    await fetchInventory();
  };

  const tableRows = useMemo(
    () =>
      rows.map((item) => ({
        ...item,
        productNameText: item.productName,
        status: item.statusLabel || statusText(item.status),
        productName: (
          <div className="flex items-center gap-3">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.productName}
                className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                <ImagePlus className="h-4 w-4" />
              </div>
            )}
            <span className="font-semibold text-slate-800">{item.productName}</span>
          </div>
        ),
      })),
    [rows],
  );

  const stats = useMemo(() => {
    const lowStock = rows.filter((item) => statusText(item.status) === "Low Stock").length;
    const totalStock = rows.reduce((sum, item) => sum + Number(item.hubStockQuantity || 0), 0);
    return [
      { label: "Total SKUs", value: String(rows.length) },
      { label: "Low Stock Alerts", value: String(lowStock) },
      { label: "Total Units", value: String(totalStock) },
      {
        label: "Health Score",
        value: rows.length ? `${Math.round(((rows.length - lowStock) / rows.length) * 100)}%` : "0%",
      },
    ];
  }, [rows]);

  return (
    <>
      <SupplyModuleTable
        title="Hub Inventory"
        subtitle="SOP mode: link hub stock to catalog products and maintain replenishment thresholds."
        icon={Boxes}
        topActions={[
          { label: "Add Stock", onClick: openAddModal },
          { label: loading ? "Refreshing..." : "Refresh", onClick: fetchInventory },
        ]}
        stats={stats}
        columns={[
          { key: "productName", label: "Product Name" },
          { key: "category", label: "Category" },
          { key: "hubStockQuantity", label: "Hub Stock Quantity" },
          { key: "minimumStockAlert", label: "Minimum Stock Alert" },
          { key: "status", label: "Status" },
        ]}
        rows={tableRows}
        statusColumn="status"
        renderActions={(row) => (
          <>
            <button
              type="button"
              onClick={() => openStockModal(row)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Add Stock
            </button>
            <button
              type="button"
              onClick={() => openMinModal(row)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
              Update Stock
            </button>
          </>
        )}
      />

      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Inventory Item (Catalog Linked)"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitAdd}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800">
              Add
            </button>
          </>
        }>
        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
              Select Product
            </span>
            <select
              value={addForm.productId}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, productId: e.target.value }))
              }
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400">
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {selectedProduct ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-700">Selected: {selectedProduct.name}</p>
              <p className="text-[11px] text-slate-500">Category: {selectedProduct.categoryId?.name || "N/A"}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
                Add Quantity
              </span>
              <input
                type="number"
                value={addForm.hubStockQuantity}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, hubStockQuantity: e.target.value }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
                Minimum Stock Alert
              </span>
              <input
                type="number"
                value={addForm.minimumStockAlert}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, minimumStockAlert: e.target.value }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </label>
          </div>
        </div>
      </Modal>

      <SupplyFormModal
        isOpen={stockOpen}
        onClose={() => setStockOpen(false)}
        title={`Add Stock${stockRow ? ` - ${stockRow.productNameText || ""}` : ""}`}
        submitLabel="Update"
        fields={[{ key: "stockDelta", label: "Stock Delta (+/-)", type: "number" }]}
        values={{ stockDelta }}
        onChange={(_, value) => setStockDelta(value)}
        onSubmit={submitStock}
      />

      <SupplyFormModal
        isOpen={minOpen}
        onClose={() => setMinOpen(false)}
        title={`Update Min Alert${minRow ? ` - ${minRow.productNameText || ""}` : ""}`}
        submitLabel="Save"
        fields={[{ key: "minValue", label: "Minimum Stock Alert", type: "number" }]}
        values={{ minValue }}
        onChange={(_, value) => setMinValue(value)}
        onSubmit={submitMin}
      />
    </>
  );
};

export default HubInventoryPage;
