import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  ShieldCheck, 
  Store, 
  Truck, 
  Bike, 
  User, 
  ChevronRight,
  ArrowUpRight,
  Boxes
} from "lucide-react";
import { useSettings } from "@core/context/SettingsContext";

const AuthSelection = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const appName = settings?.appName || "Pack n Pure";

  const portals = [
    {
      id: "customer",
      title: "Consumer Portal",
      desc: "Shop essentials & track orders",
      icon: User,
      path: "/login",
      color: "bg-emerald-50 text-emerald-600",
      accent: "hover:border-emerald-200 hover:shadow-emerald-50",
      role: "User"
    },
    {
      id: "seller",
      title: "Merchant Center",
      desc: "Manage products & bulk orders",
      icon: Store,
      path: "/seller/auth",
      color: "bg-slate-900 text-white",
      accent: "hover:border-slate-300 hover:shadow-slate-100",
      role: "Vendor"
    },
    {
      id: "pickup",
      title: "Pickup Hub",
      desc: "Local vendor-to-hub transfers",
      icon: Boxes,
      path: "/pickup/auth",
      color: "bg-sky-50 text-sky-600",
      accent: "hover:border-sky-200 hover:shadow-sky-50",
      role: "Partner"
    },
    {
      id: "delivery",
      title: "Delivery Fleet",
      desc: "Hub-to-customer doorstep delivery",
      icon: Bike,
      path: "/delivery/auth",
      color: "bg-amber-50 text-amber-600",
      accent: "hover:border-amber-200 hover:shadow-amber-50",
      role: "Rider"
    },
    {
      id: "admin",
      title: "Control Tower",
      desc: "System analytics & management",
      icon: ShieldCheck,
      path: "/admin/auth",
      color: "bg-rose-50 text-rose-600",
      accent: "hover:border-rose-200 hover:shadow-rose-50",
      role: "Master Admin"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-['Outfit']">
      {/* Dynamic Background Blobs */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-200 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-4xl w-full relative z-10">
        <div className="text-center mb-12 space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[3px] text-slate-500">Workspace Selection</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight"
          >
            Welcome to <span className="text-emerald-600">{appName}</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 font-medium max-w-lg mx-auto"
          >
            Choose your dedicated workspace to start managing your part of the hyperlocal ecosystem.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portals.map((portal, idx) => (
            <motion.div
              key={portal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => navigate(portal.path)}
              className={`group bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm cursor-pointer transition-all duration-300 ${portal.accent} hover:-translate-y-2`}
            >
              <div className="flex flex-col h-full space-y-5">
                <div className="flex justify-between items-start">
                  <div className={`p-4 rounded-2xl ${portal.color} shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                    <portal.icon size={24} />
                  </div>
                  <div className="h-8 w-8 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
                    <ArrowUpRight size={16} />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{portal.role}</span>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{portal.title}</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">{portal.desc}</p>
                </div>

                <div className="pt-2 flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-widest group-hover:gap-4 transition-all duration-300">
                  Enter Portal <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[6px]">Powered by {appName} Supply Chain Logic</p>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthSelection;
