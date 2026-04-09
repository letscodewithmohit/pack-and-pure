import React, { useEffect, useMemo, useState } from "react";
import { Store } from "lucide-react";
import SupplyModuleTable from "../components/supply/SupplyModuleTable";
import {
  SupplyFormModal,
  SupplyInfoModal,
} from "../components/supply/SupplyActionModals";
import { adminApi } from "../services/adminApi";

const emptyVendorForm = {
  name: "",
  shopName: "",
  email: "",
  phone: "",
  password: "",
  lat: "",
  lng: "",
  radius: "5",
  status: "Active",
};

const emptyRequestForm = { productId: "", quantity: "100" };

const VendorManagementPage = () => {
  const [rows, setRows] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [currentVendor, setCurrentVendor] = useState(null);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [requestForm, setRequestForm] = useState(emptyRequestForm);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchSellers();
    fetchProducts();
  }, []);

  const toLocationText = (seller) => {
    const coords = seller?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return "N/A";
    const lat = Number(coords[1]);
    const lng = Number(coords[0]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "N/A";
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  };

  const normalizeRows = (list) =>
    (Array.isArray(list) ? list : []).map((item) => ({
      id: item._id,
      vendorName: item.shopName || item.name || "N/A",
      name: item.name || "",
      shopName: item.shopName || "",
      email: item.email || "",
      phoneNumber: item.phone || "N/A",
      location: toLocationText(item),
      radius: item.serviceRadius ?? 5,
      status: item.isActive ? "Active" : "Inactive",
      raw: item,
    }));

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getSellers();
      const payload = res?.data?.result || res?.data?.results || [];
      setRows(normalizeRows(payload));
    } catch (error) {
      setInfoMessage(error?.response?.data?.message || "Failed to load sellers.");
      setInfoOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await adminApi.getProducts({
        page: 1,
        limit: 300,
        status: "active",
      });
      const payload = res?.data?.result || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      setProducts(items);
    } catch {
      setProducts([]);
    }
  };

  const toSellerPayload = (form, { requirePassword }) => {
    const name = form.name.trim();
    const shopName = form.shopName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const password = form.password.trim();
    if (!name || !shopName || !email || !phone || (requirePassword && !password)) {
      return null;
    }

    const payload = {
      name,
      shopName,
      email,
      phone,
      radius: Math.max(1, Number(form.radius || 5)),
      isActive: form.status === "Active",
      isVerified: true,
    };

    if (password) payload.password = password;

    const lat = form.lat === "" ? undefined : Number(form.lat);
    const lng = form.lng === "" ? undefined : Number(form.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      payload.lat = lat;
      payload.lng = lng;
    }

    return payload;
  };

  const addVendor = async () => {
    const payload = toSellerPayload(vendorForm, { requirePassword: true });
    if (!payload) return;
    try {
      await adminApi.createSeller(payload);
      setVendorForm(emptyVendorForm);
      setAddOpen(false);
      await fetchSellers();
      setInfoMessage("Seller created with canonical seller schema.");
      setInfoOpen(true);
    } catch (error) {
      setInfoMessage(error?.response?.data?.message || "Failed to create seller.");
      setInfoOpen(true);
    }
  };

  const openEdit = (row) => {
    setCurrentVendor(row);
    setVendorForm({
      name: row.name || "",
      shopName: row.shopName || "",
      email: row.email || "",
      phone: row.phoneNumber === "N/A" ? "" : row.phoneNumber,
      password: "",
      lat:
        row.raw?.location?.coordinates?.[1] !== undefined
          ? String(row.raw.location.coordinates[1])
          : "",
      lng:
        row.raw?.location?.coordinates?.[0] !== undefined
          ? String(row.raw.location.coordinates[0])
          : "",
      radius: String(row.radius ?? 5),
      status: row.status,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!currentVendor) return;
    const payload = toSellerPayload(vendorForm, { requirePassword: false });
    if (!payload) return;

    try {
      await adminApi.updateSeller(currentVendor.id, payload);
      setEditOpen(false);
      await fetchSellers();
      setInfoMessage("Seller updated using shared seller schema.");
      setInfoOpen(true);
    } catch (error) {
      setInfoMessage(error?.response?.data?.message || "Failed to update seller.");
      setInfoOpen(true);
    }
  };

  const openRequest = (row) => {
    setCurrentVendor(row);
    setRequestForm(emptyRequestForm);
    setRequestOpen(true);
  };

  const createPurchaseRequest = async () => {
    if (!currentVendor) return;
    const productId = String(requestForm.productId || "").trim();
    if (!productId) {
      setInfoMessage("Please select a product.");
      setInfoOpen(true);
      return;
    }
    const qty = Math.max(1, Number(requestForm.quantity || 1));
    if (!Number.isFinite(qty) || qty <= 0) {
      setInfoMessage("Please enter valid quantity.");
      setInfoOpen(true);
      return;
    }
    try {
      await adminApi.createManualPurchaseRequest({
        vendorId: currentVendor.id,
        productId,
        quantity: qty,
      });
      setRequestOpen(false);
      setInfoMessage("Purchase request created and synced to Purchase Requests module.");
      setInfoOpen(true);
    } catch (error) {
      setInfoMessage(error?.response?.data?.message || "Failed to create purchase request.");
      setInfoOpen(true);
    }
  };

  const stats = useMemo(() => {
    const active = rows.filter((item) => item.status.toLowerCase() === "active").length;
    const withGeo = rows.filter((item) => item.location !== "N/A").length;
    return [
      { label: "Total Sellers", value: String(rows.length) },
      { label: "Active Sellers", value: String(active) },
      { label: "Inactive Sellers", value: String(Math.max(0, rows.length - active)) },
      { label: "Geo Mapped", value: String(withGeo) },
    ];
  }, [rows]);

  return (
    <>
      <SupplyModuleTable
        title="Vendors / Sellers"
        subtitle="Manage suppliers using the same canonical schema used by the Seller app."
        icon={Store}
        topActions={[
          {
            label: "Add Seller",
            onClick: () => {
              setVendorForm(emptyVendorForm);
              setAddOpen(true);
            },
          },
          {
            label: loading ? "Refreshing..." : "Refresh",
            onClick: fetchSellers,
          },
        ]}
        stats={stats}
        columns={[
          { key: "vendorName", label: "Shop Name" },
          { key: "name", label: "Owner Name" },
          { key: "email", label: "Email" },
          { key: "phoneNumber", label: "Phone Number" },
          { key: "location", label: "Location" },
          { key: "radius", label: "Radius (km)" },
          { key: "status", label: "Status" },
        ]}
        rows={rows}
        statusColumn="status"
        renderActions={(row) => (
          <>
            <button
              type="button"
              onClick={() => openEdit(row)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Edit Seller
            </button>
            <button
              type="button"
              onClick={() => openRequest(row)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              Send Purchase Request
            </button>
          </>
        )}
      />

      <SupplyFormModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Seller"
        submitLabel="Add"
        fields={[
          { key: "name", label: "Owner Name" },
          { key: "shopName", label: "Shop Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "password", label: "Password (min 6 chars)" },
          { key: "lat", label: "Latitude", type: "number" },
          { key: "lng", label: "Longitude", type: "number" },
          { key: "radius", label: "Service Radius (km)", type: "number" },
          { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
        ]}
        values={vendorForm}
        onChange={(key, value) => setVendorForm((prev) => ({ ...prev, [key]: value }))}
        onSubmit={addVendor}
      />

      <SupplyFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Seller${currentVendor ? ` - ${currentVendor.vendorName}` : ""}`}
        submitLabel="Save"
        fields={[
          { key: "name", label: "Owner Name" },
          { key: "shopName", label: "Shop Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "password", label: "New Password (optional)" },
          { key: "lat", label: "Latitude", type: "number" },
          { key: "lng", label: "Longitude", type: "number" },
          { key: "radius", label: "Service Radius (km)", type: "number" },
          { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
        ]}
        values={vendorForm}
        onChange={(key, value) => setVendorForm((prev) => ({ ...prev, [key]: value }))}
        onSubmit={saveEdit}
      />

      <SupplyFormModal
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        title={`Send Purchase Request${currentVendor ? ` - ${currentVendor.vendorName}` : ""}`}
        submitLabel="Create"
        fields={[
          {
            key: "productId",
            label: "Product",
            type: "select",
            options: [
              { value: "", label: "Select Product" },
              ...products.map((p) => ({
                value: p._id,
                label: p.name,
              })),
            ],
          },
          { key: "quantity", label: "Quantity", type: "number" },
        ]}
        values={requestForm}
        onChange={(key, value) => setRequestForm((prev) => ({ ...prev, [key]: value }))}
        onSubmit={createPurchaseRequest}
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

export default VendorManagementPage;
