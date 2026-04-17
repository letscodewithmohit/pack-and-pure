import React, { useState, useMemo, useRef, useEffect } from "react";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineArrowLeft,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineCurrencyDollar,
  HiOutlineSwatch,
  HiOutlineFolderOpen,
  HiOutlinePhoto,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineSquaresPlus,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import axiosInstance from "@core/api/axios";
import { sellerApi } from "../services/sellerApi";


const AddProduct = () => {
  const navigate = useNavigate();
  const [modalTab, setModalTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);

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
    subcategory: "",
    header: "",
    status: "active",
    tags: "",
    weight: "",
    brand: "",
    mainImage: null,
    masterProductId: "",
    galleryImages: [],
    variants: [
      {
        id: Date.now(),
        name: "Default",
        price: "",
        salePrice: "",
        stock: "",
        sku: "",
      },
    ],
  });

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false);
  const [masterCatalog, setMasterCatalog] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [dbCategories, setDbCategories] = useState([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);

  React.useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await sellerApi.getCategoryTree();
        if (res.data.success) {
          setDbCategories(res.data.results || res.data.result || []);
        }
      } catch (error) {
        toast.error("Failed to load categories");
      } finally {
        setIsLoadingCats(false);
      }
    };
    fetchCats();
  }, []);

  const categories = dbCategories;

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name) {
      toast.error("Please fill in the Product Title");
      return;
    }

    // Validate all three category levels are selected
    if (!formData.header || !formData.category || !formData.subcategory) {
      toast.error("Please select all three category levels: Main Group, Specific Category, and Sub-Category");
      return;
    }

    const firstVariant = formData.variants[0] || {};
    if (!firstVariant.price || !firstVariant.stock) {
      toast.error("Main variant must have price and stock");
      return;
    }

    setIsSaving(true);
    try {
      const data = new FormData();

      // Basic fields
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      data.append("brand", formData.brand);
      data.append("weight", formData.weight);
      data.append("status", formData.status);

      // Map top-level price/stock from first variant for indexing/listing
      data.append("price", firstVariant.price);
      data.append("salePrice", firstVariant.salePrice || 0);
      data.append("stock", firstVariant.stock);

      // Category IDs
      data.append("headerId", formData.header);
      data.append("categoryId", formData.category);
      data.append("subcategoryId", formData.subcategory);

      // Tags
      data.append("tags", formData.tags);

      // Images
      if (formData.mainImageFile) {
        data.append("mainImage", formData.mainImageFile);
      }

      if (formData.galleryFiles && formData.galleryFiles.length > 0) {
        formData.galleryFiles.forEach(file => {
          data.append("galleryImages", file);
        });
      }

      // Variants
      data.append("variants", JSON.stringify(formData.variants));

      if (formData.masterProductId) {
        data.append("masterProductId", formData.masterProductId);
      }

      data.append("unit", formData.unit);
      
      await sellerApi.createProduct(data);
      toast.success("Product saved successfully!");
      navigate("/seller/products");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "main") {
          setFormData({
            ...formData,
            mainImage: reader.result,
            mainImageFile: file
          });
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

  const handleNameChange = async (e) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, name: val, masterProductId: "" })); // Clear mapping if user types manually
    
    if (val.trim().length < 3) { // Increased threshold to 3 for better relevance
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      // Fetch specifically from Admin products (Master Catalog) using global endpoint
      const res = await axiosInstance.get('/products', { 
        params: { search: val, limit: 20, ownerType: 'admin', status: 'active' } 
      });
      const items = res.data?.result?.items || res.data?.items || [];
      setSuggestions(items);
      setShowSuggestions(true);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchMasterCatalog = async () => {
    setIsBrowseModalOpen(true);
    setIsCatalogLoading(true);
    try {
      const res = await axiosInstance.get('/products', { 
        params: { limit: 100, ownerType: 'admin', status: 'active' } 
      });
      const items = res.data?.result?.items || res.data?.items || [];
      setMasterCatalog(items);
    } catch (err) {
      toast.error("Failed to load catalog");
    } finally {
      setIsCatalogLoading(false);
    }
  };

  const selectSuggestion = (prod) => {
    setFormData(prev => ({
      ...prev,
      name: prod.name,
      description: prod.description || '',
      masterProductId: prod._id,
      brand: prod.brand || '',
      header: prod.headerId?._id || prod.headerId || '',
      category: prod.categoryId?._id || prod.categoryId || '',
      subcategory: prod.subcategoryId?._id || prod.subcategoryId || '',
      weight: prod.weight || '',
      unit: prod.unit || 'Pieces',
      tags: Array.isArray(prod.tags) ? prod.tags.join(", ") : (prod.tags || ''),
      mainImage: prod.mainImage || null
    }));
    setShowSuggestions(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Button
          variant="ghost"
          className="pl-0 hover:bg-transparent hover:text-primary-600"
          onClick={() => navigate(-1)}>
          <HiOutlineArrowLeft className="mr-2 h-5 w-5" />
          Back to Products
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="min-w-[140px]">
            {isSaving ? (
              <>
                <HiOutlineArrowPath className="mr-2 h-5 w-5 animate-spin" />
                Publishing...
              </>
            ) : (
              "Save & Publish"
            )}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-slate-100">
        {/* Sidebar Tabs */}
        <div className="md:w-64 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto">
          {[
            { id: "general", label: "General Info", icon: HiOutlineTag },
            { id: "variants", label: "Item Variants", icon: HiOutlineSwatch },
            { id: "category", label: "Groups", icon: HiOutlineFolderOpen },
            { id: "media", label: "Photos", icon: HiOutlinePhoto },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModalTab(tab.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-md text-xs font-bold transition-all text-left",
                modalTab === tab.id
                  ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                  : "text-slate-600 hover:bg-slate-100",
              )}>
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}

          <div className="pt-8 px-4">
            <div className="p-4 bg-emerald-50 rounded-md border border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                Status
              </p>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full bg-transparent border-none text-xs font-bold text-emerald-700 outline-none p-0 cursor-pointer focus:ring-0">
                <option value="active">PUBLISHED</option>
                <option value="inactive">DRAFT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {modalTab === "general" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="space-y-1.5 flex flex-col relative" ref={suggestionsRef}>
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Product Title</span>
                  {formData.masterProductId && (
                    <span className="text-emerald-600 font-black animate-pulse">✓ MAPPED TO CATALOG</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    value={formData.name}
                    onChange={handleNameChange}
                    className={cn(
                      "w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all",
                      formData.masterProductId && "ring-2 ring-emerald-500/20 bg-emerald-50/30"
                    )}
                    placeholder="Search catalog or type a name..."
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isSearching && <HiOutlineArrowPath className="h-4 w-4 text-slate-400 animate-spin" />}
                    <button 
                       type="button"
                       onClick={fetchMasterCatalog}
                       className="px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-500 hover:text-primary hover:border-primary transition-all shadow-sm"
                    >
                      BROWSE ALL
                    </button>
                  </div>
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-[280px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Matches in Hub Catalog</p>
                    </div>
                    {suggestions.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => selectSuggestion(p)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0 group"
                      >
                        {p.mainImage ? (
                          <img src={p.mainImage} className="w-8 h-8 rounded object-cover border border-slate-200" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                            <HiOutlineCube className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium">In {p.categoryId?.name || "Catalog"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showSuggestions && suggestions.length === 0 && !isSearching && formData.name.length > 1 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 p-4 text-center animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-xs font-bold text-slate-600">No matches found in catalog.</p>
                    <p className="text-[10px] text-slate-400 mt-1">We'll create a new entry for you after approval.</p>
                  </div>
                )}
              </div>

              {/* Browse Catalog Modal Overlay */}
              {isBrowseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                  <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Master Catalog</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select a product to sell from hub inventory</p>
                      </div>
                      <button 
                        onClick={() => setIsBrowseModalOpen(false)}
                        className="p-2 hover:bg-white rounded-full transition-all"
                      >
                        <HiOutlinePlus className="h-6 w-6 text-slate-400 rotate-45" />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-200 bg-slate-50/30">
                      {isCatalogLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                          <HiOutlineArrowPath className="h-10 w-10 text-primary animate-spin" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic tracking-wider">Loading Master Catalog...</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {masterCatalog.map(p => (
                            <div 
                              key={p._id}
                              className="group p-3 bg-white rounded-2xl border border-slate-100 hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between gap-4"
                              onClick={() => {
                                selectSuggestion(p);
                                setIsBrowseModalOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-4">
                                <div className="h-16 w-16 min-w-[64px] rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
                                  <img src={p.mainImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{p.name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                      {p.categoryId?.name || 'Catalog'}
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-400 italic">Code: {p.sku || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-6 pr-2">
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Reference Price</p>
                                  <p className="text-sm font-black text-primary italic">₹{p.price}</p>
                                </div>
                                <button className="px-4 py-2 bg-primary text-white text-[10px] font-black uppercase rounded-xl hover:bg-primary-600 transition-all shadow-md shadow-primary/20">
                                  SELL THIS
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Measurement Unit <span className="text-rose-500">*</span></label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer"
                >
                  <option value="Pieces">Pieces</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="L">Liters (L)</option>
                  <option value="ml">Milliliters (ml)</option>
                  <option value="Pack">Pack</option>
                  <option value="Box">Box</option>
                  <option value="Bundle">Bundle</option>
                </select>
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  About this item
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-medium min-h-[160px] outline-none transition-all focus:ring-2 focus:ring-primary/10 resize-none overflow-y-auto"
                  placeholder="Describe the item here. If you selected from catalog, the master description will appear here..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Brand Name
                  </label>
                  <input
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="e.g. Amul"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Product Code
                  </label>
                  <input
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="AUTO-GENERATED"
                  />
                </div>
              </div>
            </div>
          )}

          {modalTab === "variants" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Product Variants
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Add different sizes, colors or weights.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setFormData({
                      ...formData,
                      variants: [
                        ...formData.variants,
                        {
                          id: Date.now(),
                          name: "",
                          price: "",
                          salePrice: "",
                          stock: "",
                          sku: "",
                        },
                      ],
                    })
                  }
                  className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-all">
                  <HiOutlineSquaresPlus className="h-4 w-4" />
                  <span>ADD VARIANT</span>
                </button>
              </div>

              <div className="space-y-3">
                {(formData.variants || []).map((variant, index) => (
                  <div
                    key={variant.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end group relative">
                    <div className="col-span-12 md:col-span-3 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Variant Name
                      </label>
                      <input
                        value={variant.name}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].name = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="e.g. 1kg Bag"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Price
                      </label>
                      <input
                        type="number"
                        value={variant.price}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].price = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="500"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest ml-1">
                        Sale
                      </label>
                      <input
                        type="number"
                        value={variant.salePrice}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].salePrice = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="450"
                        className="w-full px-3 py-2 bg-emerald-50 ring-1 ring-emerald-100 border-none rounded-xl text-xs font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Stock
                      </label>
                      <input
                        type="number"
                        value={variant.stock}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].stock = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="10"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-5 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Product Code
                      </label>
                      <input
                        value={variant.sku}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].sku = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="SKU-001"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end pb-1">
                      <button
                        onClick={() => {
                          if (formData.variants.length > 1) {
                            const newVariants = formData.variants.filter(
                              (_, i) => i !== index,
                            );
                            setFormData({ ...formData, variants: newVariants });
                          }
                        }}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modalTab === "category" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Main Group <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.header}
                    onChange={(e) =>
                      setFormData({ ...formData, header: e.target.value, category: "", subcategory: "" })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all">
                    <option value="">Select Main Group</option>
                    {categories.map((h) => (
                      <option key={h._id || h.id} value={h._id || h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Specific Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value, subcategory: "" })
                    }
                    disabled={!formData.header}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <option value="">Select Category</option>
                    {categories
                      .find((h) => (h._id || h.id) === formData.header)
                      ?.children?.map((c) => (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Sub-Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) =>
                      setFormData({ ...formData, subcategory: e.target.value })
                    }
                    disabled={!formData.category}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <option value="">Select Sub-Category</option>
                    {categories
                      .find((h) => (h._id || h.id) === formData.header)
                      ?.children?.find((c) => (c._id || c.id) === formData.category)
                      ?.children?.map((sc) => (
                        <option key={sc._id || sc.id} value={sc._id || sc.id}>
                          {sc.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {modalTab === "media" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
              {/* Main Image Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Main Cover Photo
                </label>
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-48 aspect-square rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer overflow-hidden relative">
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleImageUpload(e, "main")}
                    />
                    {formData.mainImage ? (
                      <img
                        src={formData.mainImage}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <HiOutlinePhoto className="h-10 w-10 text-slate-200 group-hover:text-primary transition-colors" />
                        <p className="text-[9px] font-bold text-slate-600 mt-2 uppercase tracking-widest group-hover:text-primary">
                          Upload Cover
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 pt-2">
                    <p className="text-xs font-bold text-slate-900">
                      Choose a primary image
                    </p>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      We show this image on the search page and the main
                      store listing. Make sure it is clear and bright.
                    </p>
                    <button className="text-[10px] font-black text-primary uppercase tracking-wider hover:underline">
                      Pick from Library
                    </button>
                  </div>
                </div>
              </div>

              {/* Gallery Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Gallery Photos (Max 5)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-md border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer relative overflow-hidden">
                      {formData.galleryImages[i - 1] ? (
                        <img
                          src={formData.galleryImages[i - 1]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={(e) => handleImageUpload(e, "gallery")}
                          />
                          <HiOutlinePlus className="h-5 w-5 text-slate-200 group-hover:text-primary transition-colors" />
                          <p className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-widest group-hover:text-primary">
                            Add
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-600 font-medium italic text-center pt-4 border-t border-slate-50">
                Quick Tip: Using WebP format at 800x800px makes your store load
                3x faster.
              </p>
            </div>
          )}

          
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
