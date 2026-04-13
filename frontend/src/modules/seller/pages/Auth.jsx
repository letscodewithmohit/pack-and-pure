import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { Mail, Lock, User, Phone, ArrowRight, Store, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { sellerApi } from '../services/sellerApi';

const Auth = () => {
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
        shopName: '',
        phone: '',
        city: '',
        state: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'name') {
            const cleaned = value.replace(/[^a-zA-Z\s]/g, '');
            setFormData({ ...formData, [name]: cleaned });
        } else if (name === 'email') {
            const cleaned = value.replace(/\s+/g, '').toLowerCase();
            setFormData({ ...formData, [name]: cleaned });
        } else if (name === 'phone') {
            const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 10);
            setFormData({ ...formData, [name]: digitsOnly });
        } else if (name === 'password') {
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
            toast.error('PIN must be exactly 6 characters.');
            return;
        }

        setIsLoading(true);
        try {
            const response = isLogin
                ? await sellerApi.login({ email: formData.email, password: formData.password })
                : await sellerApi.signup({ ...formData });

            const { token, seller } = response.data.result;
            login({ ...seller, token, role: 'seller' });
            toast.success(isLogin ? 'Welcome back!' : 'Seller account created successfully');
            navigate('/seller');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 font-['Outfit',_sans-serif]">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row"
            >
                <div className="w-full md:w-1/2 p-10 flex flex-col justify-center">
                    <div className="mb-10 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                            {logoUrl ? <img src={logoUrl} alt="Logo" className="w-10 h-10" /> : <Store className="text-indigo-600" size={32} />}
                            <span className="text-2xl font-black text-gray-900 tracking-tight">{appName} Seller</span>
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 mb-2">
                            {isLogin ? 'Welcome Back' : 'Join Our Network'}
                        </h1>
                        <p className="text-gray-500 font-medium">
                            {isLogin ? 'Manage your shop and orders efficiently.' : 'Register your business and reach more customers.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="Owner Name" className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-600 transition-all" />
                                    <input type="text" name="shopName" required value={formData.shopName} onChange={handleChange} placeholder="Shop Name" className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-600 transition-all" />
                                </div>
                                <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} placeholder="Phone Number" className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-600 transition-all" />
                            </>
                        )}
                        <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="Email Address" className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-600 transition-all" />
                        <input type="password" name="password" required value={formData.password} onChange={handleChange} placeholder="6 Digit PIN" className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-600 transition-all" />

                        <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white rounded-2xl py-4 text-base font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                            {isLoading ? "Please wait..." : (isLogin ? 'Login' : 'Create Account')}
                            {!isLoading && <ArrowRight size={20} />}
                        </button>
                    </form>

                    <div className="text-center mt-6">
                        <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                            {isLogin ? "New here? Create a merchant account" : "Already registered? Login instead"}
                        </button>
                    </div>
                </div>

                <div className="hidden md:flex w-1/2 bg-indigo-600 p-12 text-white items-center justify-center text-center">
                    <div className="space-y-8">
                        <div className="inline-block p-4 bg-white/10 rounded-3xl backdrop-blur-sm border border-white/20">
                            <MapPin size={48} className="text-white" />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-4xl font-black leading-tight">Hyperlocal<br />Growth</h2>
                            <p className="text-indigo-100 font-medium text-lg opacity-80">Join thousands of vendors delivering excellence across the city.</p>
                        </div>
                        <div className="flex justify-center gap-2">
                            <div className="h-2 w-8 bg-white rounded-full"></div>
                            <div className="h-2 w-2 bg-indigo-400 rounded-full"></div>
                            <div className="h-2 w-2 bg-indigo-400 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Auth;
