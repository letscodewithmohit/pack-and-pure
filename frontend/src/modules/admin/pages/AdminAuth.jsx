import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { UserRole } from '@core/constants/roles';
import {
    Mail,
    Lock,
    User,
    ShieldCheck,
    ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import Lottie from 'lottie-react';
import backendAnimation from '../../../assets/Backend Icon.json';
import { adminApi } from '../services/adminApi';

const AdminAuth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const appName = settings?.appName || 'App';
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
            toast.error('Password must be exactly 6 characters (digits or letters only).');
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
        <div className="flex min-h-screen items-center justify-center bg-[#f3f6ff] p-6 font-['Outfit',_sans-serif]">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-indigo-50 opacity-40 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-white opacity-60 rounded-full blur-[100px]"></div>
            </div>

            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full max-w-[1050px] min-h-[650px] bg-white rounded-[50px] shadow-[0_40px_120px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col md:flex-row border border-white"
            >
                <div className="w-full md:w-[45%] p-12 md:p-20 flex flex-col justify-center relative z-10 bg-white">
                    <div className="space-y-10">
                        <div className="space-y-3">
                            <h1 className="text-5xl font-black text-indigo-900 tracking-tight">
                                {isLogin ? 'Login' : 'Sign Up'}
                            </h1>
                            <p className="text-gray-400 font-medium text-base">
                                {isLogin ? `Welcome to ${appName} Admin Platform` : 'Start managing your platform today'}
                            </p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {!isLogin && (
                                <div className="group relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                                        <User size={20} />
                                    </div>
                                    <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="Full Name" className="w-full pl-14 pr-5 py-5 bg-[#f8f9ff] border-2 border-transparent rounded-[24px] text-sm font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-100 focus:ring-8 focus:ring-indigo-50/50 transition-all placeholder:text-gray-300" />
                                </div>
                            )}
                            <div className="group relative">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                                    <Mail size={20} />
                                </div>
                                <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="Username or email" className="w-full pl-14 pr-5 py-5 bg-[#f8f9ff] border-2 border-transparent rounded-[24px] text-sm font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-100 focus:ring-8 focus:ring-indigo-50/50 transition-all placeholder:text-gray-300" />
                            </div>
                            <div className="group relative">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                                    <Lock size={20} />
                                </div>
                                <input type="password" name="password" required value={formData.password} onChange={handleChange} placeholder="6 digit / letter PIN" className="w-full pl-14 pr-5 py-5 bg-[#f8f9ff] border-2 border-transparent rounded-[24px] text-sm font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-100 focus:ring-8 focus:ring-indigo-50/50 transition-all placeholder:text-gray-300" />
                            </div>
                            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white rounded-[24px] py-5 text-base font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                                {isLoading ? "Processing..." : (isLogin ? 'Login Now' : 'Create Account')}
                                {!isLoading && <ArrowRight size={20} />}
                            </button>
                        </form>
                        <div className="text-center pt-4">
                            <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                                {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="hidden md:flex w-[55%] relative bg-[#f8f9ff] overflow-hidden items-center justify-center">
                    <div className="absolute top-8 right-8 z-30">
                        <div className="w-20 h-20 rounded-2xl bg-white/85 backdrop-blur-sm border border-indigo-100 shadow-[0_12px_30px_rgba(79,70,229,0.18)] flex items-center justify-center">
                            {logoUrl ? <img src={logoUrl} alt="Logo" className="w-14 h-14 object-contain" /> : <ShieldCheck size={30} className="text-indigo-600" />}
                        </div>
                    </div>
                    <div className="absolute inset-y-0 -left-1 w-[200px] z-20">
                        <svg className="h-full w-full fill-white" preserveAspectRatio="none" viewBox="0 0 100 100">
                            <path d="M 0 0 C 40 0, 100 20, 100 50 C 100 80, 40 100, 0 100 Z"></path>
                        </svg>
                    </div>
                    <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-20">
                        <Lottie animationData={backendAnimation} loop={true} className="w-full max-w-[400px] drop-shadow-[0_20px_40px_rgba(79,70,229,0.15)]" />
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AdminAuth;
