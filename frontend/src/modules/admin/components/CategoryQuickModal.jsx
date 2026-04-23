import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Eye, EyeOff, ChevronDown, FolderOpen, Tag, Folder } from 'lucide-react';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CategoryQuickModal = ({ isOpen, onClose, type, parentId, onSuccess, editItem = null }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const fileInputRef = useRef(null);
    const [parentUnits, setParentUnits] = useState([]);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        description: '',
        status: 'active',
        type: type || 'header',
        parentId: parentId || '',
        order: 0
    });

    useEffect(() => {
        if (isOpen) {
            fetchParents();
            setErrors({});
            if (editItem) {
                setFormData({
                    name: editItem.name || '',
                    slug: editItem.slug || '',
                    description: editItem.description || '',
                    status: editItem.status || 'active',
                    type: editItem.type || type || 'header',
                    parentId: editItem.parentId || parentId || '',
                    order: editItem.order || 0
                });
                setPreviewUrl(editItem.image || null);
            } else {
                setFormData({
                    name: '',
                    slug: '',
                    description: '',
                    status: 'active',
                    type: type || 'header',
                    parentId: parentId || '',
                    order: 0
                });
                setPreviewUrl(null);
                setImageFile(null);
            }
        }
    }, [isOpen, editItem, type, parentId]);

    const makeSlug = (value) =>
        String(value || '')
            .toLowerCase()
            .trim()
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '');

    const fetchParents = async () => {
        try {
            const res = await adminApi.getParentUnits();
            if (res.data.success) {
                setParentUnits(res.data.results || res.data.result || []);
            }
        } catch (error) {}
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const validate = () => {
        const nextErrors = {};
        const trimmedName = String(formData.name || '').trim();
        const nextSlug = makeSlug(trimmedName);

        if (!trimmedName) nextErrors.name = 'Name is required';
        if (trimmedName && !nextSlug) nextErrors.name = 'Please enter a valid name';

        if (formData.type !== 'header' && !formData.parentId) {
            nextErrors.parentId = 'Parent is required';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return toast.error('Please fill required fields');

        setIsSaving(true);
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                data.append(key, formData[key]);
            });
            if (imageFile) {
                data.append('image', imageFile);
            }

            let response;
            if (editItem) {
                response = await adminApi.updateCategory(editItem._id || editItem.id, data);
                toast.success('Category updated successfully');
            } else {
                response = await adminApi.createCategory(data);
                toast.success('Category created successfully');
            }

            if (onSuccess) {
                onSuccess(response.data.result || response.data.results);
            }
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save category');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-4xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row"
            >
                {/* Left Side - Image Upload & Preview */}
                <div className="lg:w-1/3 bg-slate-50 p-8 border-r border-slate-100 flex flex-col justify-between">
                    <div className="space-y-8 text-center">
                        <div>
                            <Badge variant="primary" className="text-[8px] font-black uppercase tracking-[0.2em] mb-4">Master Media</Badge>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square w-48 mx-auto rounded-[2.5rem] bg-white shadow-2xl ring-1 ring-slate-200/50 flex flex-col items-center justify-center p-2 border-2 border-dashed border-slate-200 group cursor-pointer hover:border-primary/50 transition-all overflow-hidden relative"
                            >
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-[2rem]" />
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                            <Upload className="h-6 w-6 text-slate-400 group-hover:text-primary" />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Display<br/>Image</p>
                                    </div>
                                )}
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                            </div>
                        </div>

                        <div className="p-5 bg-slate-900 rounded-[2rem] text-white shadow-xl rotate-1 group hover:rotate-0 transition-transform">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{formData.type || 'Unit'} Level</span>
                                <h4 className="text-sm font-black italic tracking-tight truncate w-full px-2">{formData.name || 'Set Name...'}</h4>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="flex-1 p-8 lg:p-10 relative">
                    <button onClick={onClose} className="absolute right-8 top-8 p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 shadow-sm ring-1 ring-slate-100 bg-white">
                        <X className="h-5 w-5" />
                    </button>

                    <div className="space-y-8">
                        <header>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-8 w-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                    {type === 'header' ? <FolderOpen className="h-4 w-4" /> : type === 'category' ? <Folder className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight italic">
                                    {editItem ? 'Modify Organization' : 'On-the-go Register'}
                                </h3>
                            </div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-10">Real-time Catalog Synchronization</p>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">
                                    Classification Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                                        setFormData({
                                            ...formData,
                                            name: val,
                                            slug: makeSlug(val)
                                        });
                                    }}
                                    onBlur={validate}
                                    className={cn(
                                        "w-full px-6 py-3.5 bg-slate-100/50 border-none rounded-2xl text-[13px] font-bold text-slate-700 outline-none ring-primary/5 focus:ring-2 placeholder:text-slate-300",
                                        errors.name && "ring-rose-500/40 focus:ring-rose-500/40"
                                    )}
                                    placeholder="e.g. Fresh Produce"
                                />
                                {errors.name && (
                                    <p className="text-[10px] font-bold text-rose-500 ml-4">{errors.name}</p>
                                )}
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">System Slug</label>
                                <input value={formData.slug} readOnly className="w-full px-6 py-3.5 bg-slate-50 border-none rounded-2xl text-[11px] text-slate-400 font-mono font-bold outline-none" />
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-4">Display Priority (Order No.)</label>
                                <input 
                                    type="number"
                                    value={formData.order}
                                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                    className="w-full px-6 py-3.5 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-[13px] font-black text-indigo-700 outline-none focus:border-indigo-500 transition-all shadow-sm"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {formData.type !== 'header' && (
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">
                                    Hierarchy Positioning <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative group">
                                    <select
                                        value={formData.parentId}
                                        onChange={(e) => {
                                            if (errors.parentId) setErrors(prev => ({ ...prev, parentId: undefined }));
                                            setFormData({ ...formData, parentId: e.target.value });
                                        }}
                                        onBlur={validate}
                                        className={cn(
                                            "w-full px-6 py-3.5 bg-slate-100/50 border-none rounded-2xl text-[13px] font-bold text-slate-700 outline-none appearance-none cursor-pointer group-hover:bg-slate-100 transition-colors",
                                            errors.parentId && "ring-2 ring-rose-500/30"
                                        )}
                                    >
                                        <option value="">Choose Parent Catalog</option>
                                        {parentUnits
                                            .filter(unit => {
                                                if (formData.type === 'category') return unit.type === 'header';
                                                if (formData.type === 'subcategory') return unit.type === 'category';
                                                return false;
                                            })
                                            .map(unit => (
                                                <option key={unit._id || unit.id} value={unit._id || unit.id}>
                                                    {unit.name} ({unit.type.toUpperCase()})
                                                </option>
                                            ))
                                        }
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none group-hover:text-primary transition-colors" />
                                </div>
                                {errors.parentId && (
                                    <p className="text-[10px] font-bold text-rose-500 ml-4">{errors.parentId}</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Brief Narrative</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-6 py-4 bg-slate-100/50 border-none rounded-3xl text-[13px] font-bold text-slate-700 min-h-[100px] outline-none placeholder:text-slate-300 resize-none"
                                placeholder="Describe this organizational folder..."
                            />
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 border-dashed">
                            <div className="flex flex-col">
                                <p className="text-[13px] font-black text-slate-900 tracking-tight italic">Store Visibility</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Status determines live access</p>
                            </div>
                            <div className="flex p-1.5 bg-slate-200/40 rounded-2xl w-full md:w-auto shadow-inner">
                                <button
                                    onClick={() => setFormData({ ...formData, status: 'active' })}
                                    className={cn("flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center space-x-2 tracking-widest",
                                        formData.status === 'active' ? "bg-white text-emerald-500 shadow-md transform -translate-y-0.5" : "text-slate-400 opacity-60")}
                                >
                                    <Eye className="h-4 w-4" />
                                    <span>LIVE</span>
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, status: 'inactive' })}
                                    className={cn("flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center space-x-2 tracking-widest",
                                        formData.status === 'inactive' ? "bg-white text-slate-700 shadow-md transform -translate-y-0.5" : "text-slate-400 opacity-60")}
                                >
                                    <EyeOff className="h-4 w-4" />
                                    <span>DRAFT</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button onClick={onClose} className="flex-1 py-4 rounded-2xl text-[11px] font-black tracking-[0.2em] text-slate-400 hover:bg-slate-50 transition-all uppercase">Abort</button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-[2] py-4 rounded-2xl text-[11px] font-black tracking-[0.2em] bg-slate-900 text-white shadow-[0_20px_40px_rgba(0,0,0,0.15)] hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0 uppercase flex items-center justify-center gap-3"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        <span>Syncing Data...</span>
                                    </>
                                ) : (
                                    <span>Deploy Classification</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default CategoryQuickModal;
