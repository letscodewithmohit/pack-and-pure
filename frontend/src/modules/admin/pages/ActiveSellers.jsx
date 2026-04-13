import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    HiOutlinePlus,
    HiOutlineBuildingOffice2,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlineEye,
    HiOutlineStar,
    HiOutlineEnvelope,
    HiOutlinePhone,
    HiOutlineCalendarDays,
    HiOutlineArrowTrendingUp,
    HiOutlineMapPin,
    HiOutlineCheckCircle,
    HiOutlineXMark,
    HiOutlineChevronRight,
    HiOutlineEllipsisHorizontal
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const ActiveSellers = () => {
    const navigate = useNavigate();
    const [sellers, setSellers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchSellers = async () => {
        try {
            setIsLoading(true);
            const res = await adminApi.getSellers({ page: 1, limit: 1000 });
            const payload = res?.data?.result || {};
            const items = Array.isArray(payload.items) ? payload.items : [];
            setSellers(items);
        } catch (error) {
            console.error('Fetch sellers failed:', error);
            setSellers([]);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchSellers();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    const [viewingSeller, setViewingSeller] = useState(null);
    const [editingSeller, setEditingSeller] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState({
        minRevenue: 0,
        minRating: 0
    });

    const [formState, setFormState] = useState({
        shopName: '',
        name: '',
        email: '',
        phone: '',
        password: '',
        category: 'Grocery',
        location: '',
        serviceRadius: 5
    });

    const stats = useMemo(() => ({
        total: sellers.length,
        topRated: sellers.filter(s => (s.rating || 0) >= 4.7).length,
        highVolume: sellers.filter(s => (s.totalOrders || 0) > 100).length,
        totalRevenue: sellers.reduce((acc, current) => acc + (current.revenue || 0), 0)
    }), [sellers]);

    const filteredSellers = useMemo(() => {
        return sellers.filter(s => {
            const matchesSearch = (s.shopName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.email || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'all' || s.category === filterCategory;
            const matchesRevenue = (s.revenue || 0) >= advancedFilters.minRevenue;
            const matchesRating = (s.rating || 0) >= advancedFilters.minRating;
            return matchesSearch && matchesCategory && matchesRevenue && matchesRating;
        });
    }, [sellers, searchTerm, filterCategory, advancedFilters]);

    const handleOnboard = async (e) => {
        e.preventDefault();
        try {
            await adminApi.createSeller({
                ...formState,
                isVerified: true,
                isActive: true
            });
            setIsOnboardingOpen(false);
            setFormState({ shopName: '', name: '', email: '', phone: '', password: '', category: 'Grocery', location: '', serviceRadius: 5 });
            fetchSellers();
        } catch (error) {
            alert(error?.response?.data?.message || 'Onboarding failed');
        }
    };

    const handleEditUpdate = async (e) => {
        e.preventDefault();
        try {
            await adminApi.updateSeller(editingSeller._id, formState);
            setEditingSeller(null);
            fetchSellers();
        } catch (error) {
            alert(error?.response?.data?.message || 'Update failed');
        }
    };

    const deleteSeller = (id) => {
        if (window.confirm('Are you sure you want to remove this seller?')) {
            setSellers(sellers.filter(s => s.id !== id));
            setIsSellerModalOpen(false);
        }
    };

    const openSellerDetails = (seller) => {
        setViewingSeller(seller);
        setIsSellerModalOpen(true);
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        Active Sellers
                        <Badge variant="success" className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase">Verified</Badge>
                    </h1>
                    <p className="ds-description mt-0.5">View and manage all active sellers.</p>
                </div>
                <button
                    onClick={() => setIsOnboardingOpen(true)}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-xl hover:bg-slate-800 transition-all hover:-translate-y-0.5 flex items-center space-x-2"
                >
                    <HiOutlinePlus className="h-4 w-4" />
                    <span>ADD NEW SELLER</span>
                </button>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Verified Partners', val: stats.total, icon: HiOutlineBuildingOffice2, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Elite Sellers', val: stats.topRated, icon: HiOutlineStar, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Peak Performance', val: stats.highVolume, icon: HiOutlineArrowTrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Gross Revenue', val: `₹${(stats.totalRevenue / 100000).toFixed(1)}L`, icon: HiOutlineCheckCircle, color: 'text-indigo-600', bg: 'bg-indigo-50' }
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100 p-4 group">
                        <div className="flex items-center gap-3">
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="ds-label">{stat.label}</p>
                                <h4 className="ds-stat-medium">{stat.val}</h4>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Toolbox */}
            <Card className="border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row gap-3 items-center">
                    <div className="relative flex-1 group w-full">
                        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-all" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by shop name, owner or email..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                        />
                    </div>
                    <div className="flex gap-2 shrink-0 w-full lg:w-auto">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="all">All Specialties</option>
                            <option value="Grocery">Grocery</option>
                            <option value="Electronics">Electronics</option>
                            <option value="Dairy">Dairy</option>
                        </select>
                        <div className="relative">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "flex items-center space-x-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold transition-all",
                                    showFilters ? "bg-slate-900 text-white ring-slate-900" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <HiOutlineFunnel className="h-4 w-4" />
                                <span>Filters</span>
                            </button>

                            {showFilters && (
                                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Advanced Intel</h4>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-600">Min Revenue (₹)</label>
                                            <input
                                                type="number"
                                                value={advancedFilters.minRevenue}
                                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, minRevenue: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border-none rounded-lg text-xs font-bold outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-600">Min Rating</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="5"
                                                step="0.1"
                                                value={advancedFilters.minRating}
                                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, minRating: e.target.value })}
                                                className="w-full accent-primary"
                                            />
                                            <div className="flex justify-between text-[8px] font-bold text-slate-400">
                                                <span>0</span>
                                                <span>{advancedFilters.minRating}</span>
                                                <span>5</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setAdvancedFilters({ minRevenue: 0, minRating: 0 });
                                                setFilterCategory('all');
                                                setSearchTerm('');
                                            }}
                                            className="w-full py-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                        >
                                            RESET FILTERS
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Sellers Grid/Table */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="ds-table-header-cell px-6">Store Entity</th>
                                <th className="ds-table-header-cell px-6">Performance</th>
                                <th className="ds-table-header-cell px-6 text-center">Business Intel</th>
                                <th className="ds-table-header-cell px-6">Status</th>
                                <th className="ds-table-header-cell px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-12 w-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-4" />
                                            <p className="text-slate-500 font-bold text-sm">Fetching sellers...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSellers.length > 0 ? filteredSellers.map((s) => (
                                <tr key={s._id} className="hover:bg-slate-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div
                                            className="flex items-center gap-4 cursor-pointer group/name"
                                            onClick={() => openSellerDetails(s)}
                                        >
                                            <div className="h-12 w-12 rounded-2xl overflow-hidden bg-slate-100 ring-2 ring-slate-100 group-hover:ring-primary/20 transition-all flex items-center justify-center text-slate-300">
                                                <HiOutlineBuildingOffice2 className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 group-hover/name:text-primary transition-colors">{s.shopName}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-semibold text-slate-400">{s.name}</span>
                                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                    <span className="text-[10px] font-bold text-primary">{s.category || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex items-center text-amber-500">
                                                    <HiOutlineStar className="h-3 w-3 fill-current" />
                                                    <span className="text-xs font-bold ml-1">{s.rating || '0.0'}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-300">/ 5.0</span>
                                            </div>
                                            <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-amber-400 rounded-full"
                                                    style={{ width: `${((s.rating || 0) / 5) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-bold text-slate-900">{(s.totalOrders || 0).toLocaleString()} Orders</span>
                                            <span className="text-[9px] font-bold text-emerald-600 mt-0.5">₹{((s.revenue || 0) / 1000).toFixed(1)}k Revenue</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant={s.isActive ? "success" : "danger"} className="text-[10px]">
                                            {s.isActive ? 'ACTIVE' : 'INACTIVE'}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            <button
                                                onClick={() => openSellerDetails(s)}
                                                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-primary"
                                            >
                                                <HiOutlineEye className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center text-slate-400 font-bold">NO SELLERS FOUND</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Seller Detail Drawer/Modal */}
            <AnimatePresence>
                {isSellerModalOpen && viewingSeller && (
                    <div className="fixed inset-0 z-[100] overflow-y-auto">
                        <div className="min-h-full flex items-center justify-center p-4 lg:p-5">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                                onClick={() => setIsSellerModalOpen(false)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="w-full max-w-2xl relative z-10 bg-white rounded-xl overflow-hidden shadow-2xl my-auto"
                            >
                                <div className="relative h-32 bg-slate-900">
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent" />
                                    <button
                                        onClick={() => setIsSellerModalOpen(false)}
                                        className="absolute right-6 top-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                                    >
                                        <HiOutlineXMark className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="px-4 pb-8">
                                    <div className="relative -mt-12 flex items-end justify-between mb-8">
                                        <div className="h-24 w-24 rounded-xl border-4 border-white overflow-hidden bg-slate-100 shadow-xl flex items-center justify-center text-slate-300">
                                            <HiOutlineBuildingOffice2 className="h-10 w-10" />
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => {
                                                    setEditingSeller(viewingSeller);
                                                    setFormState({
                                                        shopName: viewingSeller.shopName,
                                                        name: viewingSeller.name,
                                                        email: viewingSeller.email,
                                                        phone: viewingSeller.phone,
                                                        category: viewingSeller.category || 'Grocery',
                                                        location: viewingSeller.location?.coordinates?.join(', ') || '',
                                                        serviceRadius: viewingSeller.serviceRadius
                                                    });
                                                    setIsSellerModalOpen(false);
                                                }}
                                                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg transition-all hover:-translate-y-0.5"
                                            >
                                                EDIT
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-6">
                                            <div>
                                                <h2 className="ds-h1">{viewingSeller.shopName}</h2>
                                                <p className="ds-description mt-0.5">{viewingSeller.category || 'Business'} Partner</p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <HiOutlineBuildingOffice2 className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-bold">{viewingSeller.name} (Owner)</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <HiOutlineEnvelope className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-semibold">{viewingSeller.email}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <HiOutlinePhone className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-bold">{viewingSeller.phone}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-xl p-6 space-y-6">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Snapshot</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Sales</p>
                                                    <p className="text-lg font-bold text-slate-900">₹{((viewingSeller.revenue || 0) / 1000).toFixed(1)}k</p>
                                                </div>
                                                <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Orders</p>
                                                    <p className="text-lg font-bold text-slate-900">{viewingSeller.totalOrders || 0}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
            {/* Onboarding / Edit Modal */}
            <AnimatePresence>
                {(isOnboardingOpen || editingSeller) && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                            onClick={() => { setIsOnboardingOpen(false); setEditingSeller(null); }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-lg relative z-[120] bg-white rounded-xl p-4 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{editingSeller ? 'Edit Shop Profile' : 'Onboard New Shop'}</h3>
                                    <p className="text-xs text-slate-500 font-medium">Configure store settings and identity.</p>
                                </div>
                                <button onClick={() => { setIsOnboardingOpen(false); setEditingSeller(null); }} className="p-2 hover:bg-slate-100 rounded-full">
                                    <HiOutlineXMark className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={editingSeller ? handleEditUpdate : handleOnboard} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Shop Name</label>
                                        <input
                                            required
                                            value={formState.shopName}
                                            onChange={(e) => setFormState({ ...formState, shopName: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none ring-1 ring-slate-100 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Specialty</label>
                                        <select
                                            value={formState.category}
                                            onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                        >
                                            <option>Grocery</option>
                                            <option>Electronics</option>
                                            <option>Dairy</option>
                                            <option>Fruits & Veggies</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Owner Name</label>
                                    <input
                                        required
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none ring-1 ring-slate-100 focus:ring-primary/20 transition-all"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={formState.email}
                                            onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                                        <input
                                            required
                                            value={formState.phone}
                                            onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                        />
                                    </div>
                                </div>

                                {!editingSeller && (
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={formState.password}
                                            onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none ring-1 ring-slate-100 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-4 gap-4 items-end">
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Coordinates (Lng, Lat)</label>
                                        <input
                                            placeholder="e.g. 77.123, 28.123"
                                            value={formState.location}
                                            onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Range (km)</label>
                                        <input
                                            type="number"
                                            value={formState.serviceRadius}
                                            onChange={(e) => setFormState({ ...formState, serviceRadius: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-bold shadow-xl hover:bg-slate-800 transition-all transform active:scale-[0.98] mt-4">
                                    {editingSeller ? 'UPDATE SHOP PROFILE' : 'FINALIZE ONBOARDING'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ActiveSellers;
