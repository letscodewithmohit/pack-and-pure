import React, { useState } from "react";
import { useAuth } from "@core/context/AuthContext";
import { 
  User, 
  Phone, 
  Truck, 
  MapPin, 
  ShieldCheck, 
  LogOut, 
  ChevronRight, 
  Camera, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";

const Profile = () => {
  const { user, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    vehicleNumber: user?.vehicleNumber || "UP-14-AX-5566", // Example placeholder if missing
    address: user?.address || "Hub Primary Zone",
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await pickupApi.updateProfile({
        name: formData.name,
        vehicleType: formData.vehicleNumber
      });
      toast.success("Profile updated successfully in Database!");
      setIsEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-['Outfit']">
      {/* Header */}
      <div className="bg-slate-900 text-white p-8 pt-12 rounded-b-[40px] shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative group">
            <div className="h-24 w-24 bg-white/20 backdrop-blur-md rounded-3xl border-2 border-white/30 flex items-center justify-center overflow-hidden">
               {user?.avatar ? (
                 <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <User size={40} className="text-white" />
               )}
            </div>
            <button className="absolute -bottom-2 -right-2 bg-indigo-500 p-2 rounded-xl shadow-lg border-2 border-slate-900 hover:bg-indigo-600 transition-colors">
              <Camera size={14} className="text-white" />
            </button>
          </div>
          <h2 className="mt-4 text-xl font-black tracking-tight">{user?.name || "Pickup Partner"}</h2>
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-[4px] mt-1">ID: {user?._id?.slice(-6).toUpperCase()}</p>
        </div>
      </div>

      <main className="max-w-md mx-auto px-6 -mt-8 relative z-20 space-y-6">
        {/* Verification Status Card */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">KYC Status</p>
              <p className="text-sm font-bold text-slate-900">SOP Verified Partner</p>
            </div>
          </div>
          <CheckCircle2 className="text-emerald-500" size={24} />
        </div>

        {/* Profile Info Form */}
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Personal Details</h3>
             <button 
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full"
             >
               {isEditing ? "Cancel" : "Edit"}
             </button>
          </div>

          <form onSubmit={handleUpdate} className="p-6 space-y-5">
             <div className="space-y-1.5 group">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    disabled={!isEditing}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-70"
                  />
                </div>
             </div>

             <div className="space-y-1.5 group">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    disabled={true} // Usually phone isn't edited directly
                    value={formData.phone}
                    className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-900 opacity-60"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  </div>
                </div>
             </div>

             <div className="space-y-1.5 group">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Vehicle Details</label>
                <div className="relative">
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    disabled={!isEditing}
                    placeholder="Enter Vehicle Number"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({...formData, vehicleNumber: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-70 placeholder:text-slate-300 uppercase"
                  />
                </div>
             </div>

             <AnimatePresence>
               {isEditing && (
                 <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[2px] shadow-xl shadow-slate-200 transition-all hover:bg-black active:scale-95 disabled:opacity-50"
                 >
                   {isLoading ? "Saving Changes..." : "Save Profile Details"}
                 </motion.button>
               )}
             </AnimatePresence>
          </form>
        </div>

        {/* Support & Logout */}
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl p-2">
           <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
             <div className="flex items-center gap-4">
               <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><AlertCircle size={20}/></div>
               <span className="text-sm font-bold text-slate-900">Help & Support</span>
             </div>
             <ChevronRight size={18} className="text-slate-300" />
           </button>
           <button 
            onClick={logout}
            className="w-full flex items-center justify-between p-4 hover:bg-rose-50 rounded-2xl transition-colors group"
           >
             <div className="flex items-center gap-4">
               <div className="h-10 w-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center"><LogOut size={20}/></div>
               <span className="text-sm font-bold text-rose-600">Logout Session</span>
             </div>
             <ChevronRight size={18} className="text-rose-200" />
           </button>
        </div>
      </main>

      {/* Persistent Tagline */}
      <div className="mt-8 mb-4 text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[6px]">Pack Prep Premium Supply</p>
      </div>
    </div>
  );
};

export default Profile;
