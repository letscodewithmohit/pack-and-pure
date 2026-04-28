import React, { useState, useMemo, useRef, useEffect } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlinePlus,
  HiOutlineCube,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineEye,
  HiOutlinePhoto,
  HiOutlineCurrencyDollar,
  HiOutlineArchiveBox,
  HiOutlineTag,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineXMark,
  HiOutlineChevronRight,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineFolderOpen,
  HiOutlineSwatch,
  HiOutlineSquaresPlus,
  HiOutlineLink,
} from "react-icons/hi2";
import axiosInstance from "@core/api/axios";
import Modal from "@shared/components/ui/Modal";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useAuth } from "@/core/context/AuthContext";

import { MagicCard } from "@/components/ui/magic-card";
import { BlurFade } from "@/components/ui/blur-fade";
import ShimmerButton from "@/components/ui/shimmer-button";
import Pagination from "@shared/components/ui/Pagination";

const ProductManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isVerified = user?.isVerified;

  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get("q") || "";

  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const fetchProducts = async (requestedPage = 1) => {
    setIsLoading(true);
    try {
      const res = await sellerApi.getProducts({ page: requestedPage, limit: pageSize });
      if (res.data.success) {
        const payload = res.data.result || {};
        const rawProducts = Array.isArray(payload.items)
          ? payload.items
          : (res.data.results || []);
        const safe = Array.isArray(rawProducts) ? rawProducts : [];
        setProducts(safe);
        setTotal(typeof payload.total === "number" ? payload.total : safe.length);
        setPage(typeof payload.page === "number" ? payload.page : requestedPage);
      }
    } catch (error) {
      toast.error("Failed to fetch products");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await sellerApi.getCategoryTree();
      if (res.data.success) {
        setDbCategories(res.data.results || res.data.result || []);
      }
    } catch (error) {
      // fail silently
    }
  };

  useEffect(() => {
    fetchProducts(1);
    fetchCategories();
  }, []);

  const categories = dbCategories;
  const [searchTerm, setSearchTerm] = useState(qFromUrl);

  useEffect(() => {
    if (qFromUrl !== searchTerm) setSearchTerm(qFromUrl);
  }, [qFromUrl]);

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("All");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [viewingVariants, setViewingVariants] = useState(null);
  const [isVariantsViewModalOpen, setIsVariantsViewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalTab, setModalTab] = useState("general");

  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    description: "",
    price: "",
    salePrice: "",
    stock: "",
    lowStockAlert: 5,
    unit: "Pieces",
    category: "",
    header: "",
    subcategory: "",
    status: "pending_approval",
    tags: "",
    weight: "",
    brand: "",
    shelfLife: "",
    countryOfOrigin: "",
    fssaiLicense: "",
    customerCare: "",
    masterProductId: "",
    mainImage: null,
    galleryImages: [],
    variants: [{ id: Date.now(), name: "Default", price: "", salePrice: "", stock: "", sku: "" }],
  });

  const [masterSuggestions, setMasterSuggestions] = useState([]);
  const [showMasterSuggestions, setShowMasterSuggestions] = useState(false);
  const [isSearchingMaster, setIsSearchingMaster] = useState(false);

  const searchMasterCatalog = async (val) => {
    if (val.trim().length < 2) {
      setMasterSuggestions([]);
      setShowMasterSuggestions(false);
      return;
    }
    setIsSearchingMaster(true);
    try {
      const res = await axiosInstance.get("/products", {
        params: { search: val, ownerType: "admin", limit: 8 },
      });
      const items = res.data?.result?.items || res.data?.items || [];
      setMasterSuggestions(items);
      setShowMasterSuggestions(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingMaster(false);
    }
  };

  const handleMasterLink = (master) => {
    setFormData((prev) => ({
      ...prev,
      masterProductId: master._id,
      header: master.headerId?._id || master.headerId || prev.header,
      category: master.categoryId?._id || master.categoryId || prev.category,
      subcategory: master.subcategoryId?._id || master.subcategoryId || prev.subcategory,
      shelfLife: master.shelfLife || prev.shelfLife,
      countryOfOrigin: master.countryOfOrigin || prev.countryOfOrigin,
      fssaiLicense: master.fssaiLicense || prev.fssaiLicense,
      customerCare: master.customerCare || prev.customerCare,
    }));
    setShowMasterSuggestions(false);
    toast.success(`Mapped to Catalog: ${master.name}`);
  };

  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;

    return safeProducts.filter((p) => {
      const variantSkus = Array.isArray(p.variants)
        ? p.variants.map((v) => (v?.sku || "").toString().toLowerCase()).filter(Boolean)
        : [];
      const skuCandidate = (p.sku || "").toString().toLowerCase() || (variantSkus.length > 0 ? variantSkus[0] : "");

      const matchesSearch = !term || p.name.toLowerCase().includes(term) || (!!skuCandidate && skuCandidate.includes(term));
      const matchesCategory = filterCategory === "all" || (p.categoryId?._id || p.categoryId) === filterCategory || (p.headerId?._id || p.headerId) === filterCategory;

      let matchesStatus = filterStatus === "All";
      if (filterStatus === "Active") matchesStatus = p.status === "active";
      if (filterStatus === "Low Stock") matchesStatus = p.stock > 0 && p.stock <= 10;
      if (filterStatus === "Out of Stock") matchesStatus = p.stock === 0;

      let matchesPrice = true;
      const effectivePrice = Number(p.salePrice ?? p.price ?? 0);
      if (min !== null && !Number.isNaN(min)) matchesPrice = matchesPrice && effectivePrice >= min;
      if (max !== null && !Number.isNaN(max)) matchesPrice = matchesPrice && effectivePrice <= max;

      return matchesSearch && matchesCategory && matchesStatus && matchesPrice;
    });
  }, [safeProducts, searchTerm, filterCategory, filterStatus, priceMin, priceMax]);

  const stats = useMemo(() => ({
    total: safeProducts.length,
    lowStock: safeProducts.filter((p) => p.stock > 0 && p.stock <= 10).length,
    outOfStock: safeProducts.filter((p) => p.stock === 0).length,
    active: safeProducts.filter((p) => p.status === "active").length,
  }), [safeProducts]);

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.price || !formData.stock || !formData.header || !formData.category || !formData.subcategory) {
        toast.error("Please fill all required fields, including categories");
        return;
      }
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        if (key !== 'mainImage' && key !== 'galleryImages' && key !== 'variants') {
          data.append(key, formData[key]);
        }
      });
      data.append("headerId", formData.header);
      data.append("categoryId", formData.category);
      data.append("subcategoryId", formData.subcategory);
      data.append("variants", JSON.stringify(formData.variants));

      if (formData.mainImageFile) data.append("mainImage", formData.mainImageFile);
      if (formData.galleryFiles?.length > 0) {
        formData.galleryFiles.forEach((file) => data.append("galleryImages", file));
      }

      if (editingItem) {
        await sellerApi.updateProduct(editingItem._id || editingItem.id, data);
        toast.success("Product updated and sent for admin approval");
      } else {
        await sellerApi.createProduct(data);
        toast.success("Product created and sent for admin approval");
      }
      setIsProductModalOpen(false);
      setEditingItem(null);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    }
  };

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "main") {
          setFormData({ ...formData, mainImage: reader.result, mainImageFile: file });
        } else {
          setFormData({
            ...formData,
            galleryImages: [...formData.galleryImages, reader.result],
            galleryFiles: [...(formData.galleryFiles || []), file]
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const openEditModal = (item = null) => {
    if (item) {
      setFormData({
        name: item.name || "",
        slug: item.slug || "",
        sku: item.sku || "",
        description: item.description || "",
        price: item.price || "",
        salePrice: item.salePrice || "",
        stock: item.stock || "",
        lowStockAlert: item.lowStockAlert || 5,
        header: item.headerId?._id || item.headerId || "",
        category: item.categoryId?._id || item.categoryId || "",
        subcategory: item.subcategoryId?._id || item.subcategoryId || "",
        status: item.status || "pending_approval",
        tags: Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || "",
        weight: item.weight || "",
        unit: item.unit || "Pieces",
        brand: item.brand || "",
        shelfLife: item.shelfLife || "",
        countryOfOrigin: item.countryOfOrigin || "",
        fssaiLicense: item.fssaiLicense || "",
        customerCare: item.customerCare || "",
        masterProductId: item.masterProductId || "",
        mainImage: item.mainImage || null,
        galleryImages: item.galleryImages || [],
        variants: (item.variants && item.variants.length > 0) ? item.variants.map(v => ({ ...v, id: v._id || Date.now() })) : [
          { id: Date.now(), name: "Default", price: item.price || "", salePrice: item.salePrice || "", stock: item.stock || "", sku: item.sku || "" },
        ],
      });
      setEditingItem(item);
    } else {
      setFormData({
        name: "",
        slug: "",
        sku: "",
        description: "",
        price: "",
        salePrice: "",
        stock: "",
        lowStockAlert: 5,
        category: "",
        header: "",
        subcategory: "",
        status: "pending_approval",
        tags: "",
        weight: "",
        unit: "Pieces",
        brand: "",
        mainImage: null,
        galleryImages: [],
        variants: [{ id: Date.now(), name: "Default", price: "", salePrice: "", stock: "", sku: "" }],
      });
      setEditingItem(null);
    }
    setIsProductModalOpen(true);
  };

  const exportProducts = () => alert("Exporting " + safeProducts.length + " products as CSV (Simulation)");

  const handleDeleteClick = (product) => {
    setItemToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await sellerApi.deleteProduct(itemToDelete._id || itemToDelete.id);
      toast.success("Product deleted successfully");
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchProducts();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-slate-50/50 min-h-screen font-['Outfit',_sans-serif]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Inventory Management</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Track, manage and optimize your hyperlocal stock.</p>
        </div>
        <div className="flex items-center gap-3">
          <ShimmerButton onClick={exportProducts} className="shadow-2xl" background="white" color="black">
            <span className="whitespace-pre-wrap text-center text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <HiOutlineArrowPath className="h-4 w-4" /> Export CSV
            </span>
          </ShimmerButton>
          <ShimmerButton disabled={!isVerified} onClick={() => openEditModal()} className="shadow-2xl">
            <span className="whitespace-pre-wrap text-center text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <HiOutlinePlus className="h-4 w-4" /> Add New Product
            </span>
          </ShimmerButton>
        </div>
      </div>

      {!isVerified && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800">
          <HiOutlineExclamationCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">Your account is pending admin approval. You can prepare products but they won't be visible to customers until verified.</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "All Items", val: stats.total, icon: HiOutlineCube, color: "text-indigo-600", bg: "bg-indigo-50", status: "All" },
          { label: "Active Items", val: stats.active, icon: HiOutlineCheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", status: "Active" },
          { label: "Low Stock", val: stats.lowStock, icon: HiOutlineExclamationCircle, color: "text-amber-600", bg: "bg-amber-50", status: "Low Stock" },
          { label: "Out of Stock", val: stats.outOfStock, icon: HiOutlineArchiveBox, color: "text-rose-600", bg: "bg-rose-50", status: "Out of Stock" },
        ].map((stat, i) => (
          <BlurFade key={i} delay={0.1 + i * 0.05}>
            <div
              onClick={() => setFilterStatus(stat.status)}
              className={cn(
                "cursor-pointer rounded-lg transition-all duration-300",
                filterStatus === stat.status ? "ring-2 ring-indigo-500 shadow-lg" : "hover:shadow-md"
              )}>
              <MagicCard className="border-none shadow-sm ring-1 ring-slate-100 p-0 overflow-hidden group bg-white"
                gradientColor={stat.bg.includes("indigo") ? "#eef2ff" : stat.bg.includes("emerald") ? "#ecfdf5" : stat.bg.includes("amber") ? "#fffbeb" : "#fff1f2"}>
                <div className="flex items-center gap-3 p-4 relative z-10">
                  <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 duration-300 shadow-sm", stat.bg, stat.color)}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">{stat.label}</p>
                    <h4 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{stat.val}</h4>
                  </div>
                </div>
              </MagicCard>
            </div>
          </BlurFade>
        ))}
      </div>

      {/* Toolbox */}
      <BlurFade delay={0.25}>
        <Card className="relative z-30 border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
          <div className="flex flex-col lg:flex-row gap-3 items-center">
            <div className="relative flex-1 group w-full">
              <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-primary transition-all" />
              <input type="text" value={searchTerm} onChange={(e) => {
                setSearchTerm(e.target.value);
                const next = new URLSearchParams(searchParams);
                if (e.target.value) next.set("q", e.target.value); else next.delete("q");
                setSearchParams(next);
              }} placeholder="Search by name or SKU..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/5 transition-all outline-none" />
            </div>
            <div className="relative flex gap-2 shrink-0 w-full lg:w-auto">
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer">
                <option value="all">All Categories</option>
                {categories.map((h) => (
                  <optgroup key={h._id || h.id} label={h.name}>
                    {(h.children || []).map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button onClick={() => setIsFilterOpen((prev) => !prev)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                <HiOutlineFunnel className="h-4 w-4" /> <span>Filters</span>
              </button>
            </div>
          </div>
        </Card>
      </BlurFade>

      {/* Product Table */}
      <BlurFade delay={0.3}>
        <Card className="relative z-10 border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-3xl mt-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border border-slate-200 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-black text-slate-900 uppercase tracking-widest">Product</th>
                  <th className="px-6 py-4 text-sm font-black text-slate-900 uppercase tracking-widest">SKU</th>
                  <th className="px-6 py-4 text-sm font-black text-slate-900 uppercase tracking-widest">Category</th>
                  <th className="px-6 py-4 text-sm font-black text-slate-900 uppercase tracking-widest">Price</th>
                  <th className="px-6 py-4 text-sm font-black text-slate-900 uppercase tracking-widest text-center">Stock</th>
                  <th className="px-6 py-4 text-sm font-black text-slate-900 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p._id || p.id} className="hover:bg-slate-50 transition-colors group border-b border-slate-200 last:border-b-0">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200">
                          <img src={p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2"} alt={p.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <p className="text-base font-medium text-slate-900">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">{p.sku || "—"}</td>
                    <td className="px-6 py-4 text-sm">{p.categoryId?.name || "N/A"}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-base font-bold">₹{p.salePrice || p.price}</span>
                        {p.salePrice > 0 && <span className="text-xs text-slate-400 line-through">₹{p.price}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("text-base font-bold", p.stock === 0 ? "text-rose-600" : p.stock <= 10 ? "text-amber-600" : "text-emerald-600")}>{p.stock}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => openEditModal(p)} className="p-2 hover:bg-white hover:text-primary rounded-lg transition-all text-slate-600 ring-1 ring-slate-200"><HiOutlinePencilSquare className="h-4 w-4" /></button>
                        <button onClick={() => handleDeleteClick(p)} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all text-slate-600 ring-1 ring-slate-200"><HiOutlineTrash className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </BlurFade>

      <div className="mt-8">
        <Pagination page={page} totalPages={Math.ceil(total / pageSize) || 1} total={total} pageSize={pageSize} onPageChange={(p) => fetchProducts(p)} onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); fetchProducts(1); }} loading={isLoading} />
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsProductModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="w-full max-w-5xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><HiOutlineCube className="h-5 w-5" /></div>
                  <h3 className="text-lg font-bold text-slate-900">{editingItem ? "Edit Product" : "Add Product"}</h3>
                </div>
                <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><HiOutlineXMark className="h-5 w-5" /></button>
              </div>

              <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                <div className="lg:w-1/4 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto">
                  {[
                    { id: "general", label: "General Info", icon: HiOutlineTag },
                    { id: "pricing", label: "Pricing & Stock", icon: HiOutlineCurrencyDollar },
                    { id: "category", label: "Groups", icon: HiOutlineFolderOpen },
                    { id: "media", label: "Photos", icon: HiOutlinePhoto },
                  ].map((tab) => (
                    <button key={tab.id} onClick={() => setModalTab(tab.id)} className={cn("w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left", modalTab === tab.id ? "bg-white text-primary shadow-sm ring-1 ring-slate-100" : "text-slate-600 hover:bg-slate-100")}>
                      <tab.icon className="h-4 w-4" /> <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 p-8 overflow-y-auto">
                  {modalTab === "general" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Product Title</label>
                          <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/5" placeholder="e.g. Premium Basmati Rice" />
                        </div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Slug</label>
                          <input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/5" placeholder="product-slug" />
                        </div>
                      </div>

                      {/* HUB-FIRST MAPPING SECTION */}
                      <div className="p-4 bg-slate-900 rounded-2xl relative overflow-visible group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <HiOutlineLink className="h-16 w-16 text-white rotate-12" />
                        </div>
                        <div className="relative z-10 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-white italic tracking-tight uppercase">Hub-First Mapping</h4>
                            {formData.masterProductId ? (
                              <Badge variant="success" className="px-2 py-0.5 text-[8px] bg-emerald-500/20 text-emerald-400">Linked</Badge>
                            ) : (
                              <Badge variant="warning" className="px-2 py-0.5 text-[8px] animate-pulse">Unlinked</Badge>
                            )}
                          </div>
                          <div className="relative">
                            <div className="relative group/search">
                              <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 group-focus-within/search:text-primary transition-all" />
                              <input 
                                type="text" 
                                autoComplete="off"
                                placeholder="Search Master Catalog..." 
                                onChange={(e) => searchMasterCatalog(e.target.value)} 
                                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:ring-1 focus:ring-primary/50" 
                              />
                            </div>
                            {showMasterSuggestions && masterSuggestions.length > 0 && (
                              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                                {masterSuggestions.map(m => (
                                  <button key={m._id} type="button" onClick={() => handleMasterLink(m)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 text-left border-b border-slate-800 last:border-0">
                                    <img src={m.mainImage} alt="" className="h-8 w-8 rounded object-cover" />
                                    <div>
                                      <p className="text-xs font-bold text-white">{m.name}</p>
                                      <p className="text-[9px] text-slate-500 uppercase tracking-tighter">{m.categoryId?.name || 'Master'}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {formData.masterProductId && (
                            <button onClick={() => setFormData({ ...formData, masterProductId: null })} className="text-[9px] font-black text-slate-500 hover:text-rose-500 uppercase self-end">Clear Mapping</button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Description</label>
                        <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[120px] outline-none" placeholder="Product details..." />
                      </div>
                    </div>
                  )}

                  {modalTab === "pricing" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Price (₹)</label>
                          <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none" />
                        </div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-emerald-600 uppercase tracking-widest ml-1">Sale Price (₹)</label>
                          <input type="number" value={formData.salePrice} onChange={e => setFormData({ ...formData, salePrice: e.target.value })} className="w-full px-4 py-2.5 bg-emerald-50 border-none rounded-xl text-sm font-bold text-emerald-700 outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Stock</label>
                          <input type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none" />
                        </div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-rose-500 uppercase tracking-widest ml-1">Low Stock Alert</label>
                          <input type="number" value={formData.lowStockAlert} onChange={e => setFormData({ ...formData, lowStockAlert: e.target.value })} className="w-full px-4 py-2.5 bg-rose-50 border-none rounded-xl text-sm font-bold text-rose-600 outline-none" />
                        </div>
                      </div>
                    </div>
                  )}

                  {modalTab === "category" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Main Group</label>
                          <select value={formData.header} onChange={e => setFormData({ ...formData, header: e.target.value, category: "", subcategory: "" })} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer">
                            <option value="">Select Group</option>
                            {categories.map(h => <option key={h._id || h.id} value={h._id || h.id}>{h.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Category</label>
                          <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value, subcategory: "" })} disabled={!formData.header} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
                            <option value="">Select Category</option>
                            {categories.find(h => (h._id || h.id) === formData.header)?.children?.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Sub-Category</label>
                        <select value={formData.subcategory} onChange={e => setFormData({ ...formData, subcategory: e.target.value })} disabled={!formData.category} className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
                          <option value="">Select Sub-Category</option>
                          {categories.find(h => (h._id || h.id) === formData.header)?.children?.find(c => (c._id || c.id) === formData.category)?.children?.map(sc => <option key={sc._id || sc.id} value={sc._id || sc.id}>{sc.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {modalTab === "media" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Cover Photo</label>
                        <div className="w-48 aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer overflow-hidden relative group hover:border-primary">
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e => handleImageUpload(e, "main")} />
                          {formData.mainImage ? <img src={formData.mainImage} className="w-full h-full object-cover" /> : <HiOutlinePhoto className="h-10 w-10 text-slate-200" />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <button onClick={() => setIsProductModalOpen(false)} className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 uppercase tracking-widest">Cancel</button>
                <button onClick={handleSave} className="bg-slate-900 text-white px-10 py-2.5 rounded-xl text-xs font-bold shadow-xl hover:-translate-y-0.5 transition-all uppercase tracking-widest">Save Changes</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion" size="sm" footer={
        <div className="flex gap-4 justify-end w-full">
          <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button onClick={confirmDelete} className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold">Delete Product</button>
        </div>
      }>
        <div className="p-6 text-center space-y-4">
          <div className="h-20 w-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto"><HiOutlineTrash className="h-10 w-10" /></div>
          <p className="text-sm text-slate-600 leading-relaxed">Are you sure you want to delete <span className="font-bold text-slate-900">{itemToDelete?.name}</span>? This action is irreversible.</p>
        </div>
      </Modal>

      {/* Viewing Variants Modal */}
      <Modal isOpen={isVariantsViewModalOpen} onClose={() => setIsVariantsViewModalOpen(false)} title="Product Variants" size="lg">
        <div className="py-4 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Variant</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Price</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Stock</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {viewingVariants?.variants?.map((v, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 transition-all">
                    <td className="px-6 py-4 text-xs font-bold text-slate-700">{v.name}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={cn("text-xs font-bold", v.salePrice > 0 ? "text-slate-400 line-through scale-90" : "text-slate-900")}>₹{v.price}</span>
                        {v.salePrice > 0 && <span className="text-xs font-bold text-emerald-600">₹{v.salePrice}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center"><Badge variant={v.stock === 0 ? "rose" : v.stock <= 10 ? "amber" : "emerald"} className="text-[10px] font-black">{v.stock} UNITS</Badge></td>
                    <td className="px-6 py-4 text-right text-[10px] font-mono text-slate-600">{v.sku || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end"><button onClick={() => setIsVariantsViewModalOpen(false)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">Close Viewer</button></div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductManagement;
