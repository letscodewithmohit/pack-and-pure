import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import {
    Mail,
    Lock,
    User,
    ShieldCheck,
    ArrowRight,
    Activity,
    LockKeyhole,
    Globe,
    Building2
} from 'lucide-react';
import { toast } from 'sonner';
import Lottie from 'lottie-react';
import backendAnimation from '../../../assets/Backend Icon.json';
import { adminApi } from '../services/adminApi';
import Badge from '@shared/components/ui/Badge';

const AdminAuth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const appName = settings?.appName || 'Pack n Pure';
    const logoUrl = settings?.logoUrl || '';

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        adminCode: '',
        phone: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'password') {
            const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
            setFormData({ ...formData, [name]: cleaned });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const pwd = (formData.password || '').trim();
        if (!/^[a-zA-Z0-9]{6}$/.test(pwd)) {
            toast.error('Password must be exactly 6 characters.');
            return;
        }
        setIsLoading(true);

        try {
            const response = isLogin
                ? await adminApi.login({ email: formData.email, password: formData.password })
                : await adminApi.signup({ name: formData.name, email: formData.email, password: formData.password });

            const { token, admin } = response.data.result;
            login({ ...admin, token, role: 'admin' });
            toast.success(isLogin ? 'Welcome back, Administrator.' : 'Administrator Account Created.');
            navigate('/admin');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0F172A] p-4 lg:p-6 font-['Outfit',_sans-serif] overflow-hidden relative">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full max-w-6xl min-h-[700px] bg-white rounded-[48px] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row border border-white/10"
            >
                {/* Form Section */}
                <div className="w-full md:w-1/2 p-10 lg:p-20 flex flex-col justify-center relative z-10 bg-white">
                    <div className="max-w-md mx-auto w-full">
                        <div className="flex items-center gap-3 mb-12">
                            <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                                <ShieldCheck className="text-white" size={20} />
                            </div>
                            <span className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Security Gateway</span>
                        </div>

                        <div className="mb-10">
                            <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none mb-4">
                                {isLogin ? 'Admin Access' : 'Root Setup'}
                            </h1>
                            <p className="text-slate-400 font-medium text-lg">
                                {isLogin ? `Authorize to manage ${appName} ecosystem.` : 'Initialize master administrator credentials.'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <AnimatePresence mode="wait">
                                {!isLogin && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="relative group"
                                    >
                                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                        <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="Full Administrative Name" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all shadow-inner" />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="relative group">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="Master Email Address" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all shadow-inner" />
                            </div>

                            <div className="relative group">
                                <LockKeyhole className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                <input type="password" name="password" required value={formData.password} onChange={handleChange} placeholder="6-Digit Access PIN" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all tracking-[0.8em] shadow-inner" />
                            </div>

                            <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white rounded-[24px] py-6 text-lg font-black shadow-[0_20px_40px_rgba(15,23,42,0.2)] hover:bg-black hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                                {isLoading ? (
                                    <>
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>AUTHENTICATING...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{isLogin ? 'ENTER TERMINAL' : 'INITIALIZE SYSTEM'}</span>
                                        <ArrowRight size={22} />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="text-center mt-10">
                            <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
                                {isLogin ? "Request Root Credentials?" : "Return to Login Securely"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info Section */}
                <div className="hidden md:flex w-1/2 relative bg-slate-50 overflow-hidden items-center justify-center border-l border-slate-100">
                    <div className="absolute top-12 left-12 z-30">
                        <Badge variant="outline" className="bg-white border-slate-200 text-slate-400 font-black tracking-widest px-4 py-2 rounded-xl shadow-sm">
                            HQ CORE: ACTIVE
                        </Badge>
                    </div>

                    {/* Logo Floating */}
                    <div className="absolute top-12 right-12 z-30">
                        <div className="h-16 w-16 rounded-[24px] bg-white shadow-2xl flex items-center justify-center border border-slate-100">
                            {logoUrl ? <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain" /> : <Building2 className="text-slate-900" size={28} />}
                        </div>
                    </div>

                    {/* Abstract Grid Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                    <div className="relative z-10 w-full flex flex-col items-center">
                        <div className="w-full max-w-[450px] relative">
                             {/* Decorative Rings */}
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-indigo-100 rounded-full animate-ping opacity-20"></div>
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-slate-200 rounded-full"></div>
                             
                             <Lottie animationData={backendAnimation} loop={true} className="relative z-10 drop-shadow-[0_35px_60px_rgba(0,0,0,0.1)]" />
                        </div>

                        <div className="mt-12 text-center space-y-4 px-12">
                             <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                 <Activity size={12} /> System Health: 100%
                             </div>
                             <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Master Command Center</h3>
                             <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto opacity-80">Oversee entire supply chain, manage users, and monitor financial health from a single secure node.</p>
                        </div>
                    </div>

                    {/* Bottom Floating Stats */}
                    <div className="absolute bottom-10 left-10 right-10 flex justify-between items-center text-slate-300">
                         <div className="flex items-center gap-2">
                             <Globe size={14} />
                             <span className="text-[10px] font-bold uppercase tracking-widest">Global Ops Node</span>
                         </div>
                         <div className="h-px flex-1 mx-6 bg-slate-200 opacity-50"></div>
                         <span className="text-[10px] font-bold uppercase tracking-widest">v4.2.0-secure</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AdminAuth;
