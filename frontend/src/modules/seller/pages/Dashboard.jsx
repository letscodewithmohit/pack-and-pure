import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@shared/components/ui/Card";
import PageHeader from "@shared/components/ui/PageHeader";
import Badge from "@shared/components/ui/Badge";
import {
  DollarSign,
  Truck,
  Package,
  TrendingUp,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  Plus,
  Eye,
} from "lucide-react";
import {
  HiOutlineTruck,
  HiOutlineXMark,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineBanknotes,
  HiOutlineChevronDown,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useSellerOrders } from "../context/SellerOrdersContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [recentPRs, setRecentPRs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsRes, prRes] = await Promise.all([
          sellerApi.getStats(),
          sellerApi.getPurchaseRequests({ limit: 5 })
        ]);

        if (cancelled) return;

        if (statsRes.data.success) setStatsData(statsRes.data.result);
        if (prRes.data.success) {
          setRecentPRs(prRes.data.result?.items || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Dashboard Fetch Error:", error);
          toast.error("Failed to load dashboard data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const loadingOrStats = loading;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const revenueChartData = React.useMemo(() => {
    const raw = statsData?.salesTrend ?? statsData?.chartData ?? [];
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length > 0) {
      return arr.map((d) => ({
        name: d.name ?? d.date ?? "—",
        sales: Number(d.sales ?? d.revenue ?? d.total ?? 0) || 0,
      }));
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { name: dayNames[d.getDay()], sales: 0 };
    });
  }, [statsData?.salesTrend, statsData?.chartData]);
  const revenueMax = Math.max(1, ...revenueChartData.map((d) => d.sales));

  const stats = [
    {
      label: "Total Revenue",
      value: statsData?.overview?.totalSales || "₹0",
      change: "+12.5%",
      changeType: "increase",
      icon: DollarSign,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      description: "vs last month",
    },
    {
      label: "Total Orders",
      value: statsData?.overview?.totalOrders || "0",
      change: "+8.2%",
      changeType: "increase",
      icon: ShoppingBag,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      description: "vs last month",
    },
    {
      label: "Avg Order Value",
      value: statsData?.overview?.avgOrderValue || "₹0",
      change: "+2",
      changeType: "increase",
      icon: Package,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      description: "per order",
    },
    {
      label: "Pending Supplies",
      value: statsData?.overview?.pendingPRs || "0",
      change: "-3",
      changeType: "decrease",
      icon: Clock,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      description: "PRs to fulfill",
    },
  ];

  const quickActions = [
    {
      title: "Add New Product",
      description: "List a new item in your store",
      icon: Plus,
      path: "/seller/products/add",
      variant: "primary", // dark bg, white text
    },
    {
      label: "View Purchase Orders",
      title: "View Purchase Orders",
      description: "View and manage procurement requests",
      icon: Truck,
      path: "/seller/procurement",
      variant: "outline",
    },
    {
      title: "View Earnings",
      description: "Check your revenue and payouts",
      icon: DollarSign,
      path: "/seller/earnings",
      variant: "outline-emerald", // white bg, border, emerald accent
    },
  ];

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "pending":
        return "warning";
      case "processing":
      case "confirmed":
        return "info";
      case "packed":
        return "primary";
      case "shipped":
      case "out_for_delivery":
        return "secondary";
      case "delivered":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "secondary";
    }
  };

  const normalizeOrderForModal = (order) => {
    if (!order) return null;
    const addr = order.address;
    const addressStr = [
      addr?.line1,
      addr?.line2,
      addr?.city,
      addr?.state,
      addr?.pincode,
    ]
      .filter(Boolean)
      .join(", ");
    const items = (order.items || []).map((item) => ({
      name: item.name || item.productName || "Item",
      price:
        item.price ??
        (item.quantity
          ? Number(item.totalPrice ?? 0) / Number(item.quantity)
          : 0),
      qty: item.quantity ?? 1,
      image: item.image || "",
    }));
    return {
      id: order.orderId,
      customer: {
        name: order.customer?.name || "Customer",
        phone: order.customer?.phone || "",
      },
      address: addressStr || "—",
      items,
      total: Number(order.pricing?.total ?? 0),
      status: order.status || "pending",
      payment:
        order.payment?.method === "cash" || order.payment?.method === "cod"
          ? "Cash on Delivery"
          : "Online Paid",
    };
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await sellerApi.updateOrderStatus(orderId, {
        status: newStatus.toLowerCase(),
      });
      toast.success(`Order status updated to ${newStatus}`);
      setSelectedOrder((prev) =>
        prev && prev.id === orderId ? { ...prev, status: newStatus } : prev
      );
      if (typeof refreshOrders === "function") refreshOrders();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status");
    }
  };

  if (loadingOrStats) {
    return <div className="flex items-center justify-center h-screen font-bold text-slate-600">Updating Dashboard...</div>;
  }

  return (
    <div className="ds-section-spacing relative">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's what's happening with your store today."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-slate-600">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={cn(
                      "text-xs font-semibold flex items-center gap-1",
                      stat.changeType === "increase" ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    <TrendingUp className={cn("h-3 w-3", stat.changeType === "decrease" && "rotate-180")} />
                    {stat.change}
                  </span>
                  <span className="text-sm text-slate-600">{stat.description}</span>
                </div>
              </div>
              <div className={cn("p-3 rounded-lg", stat.iconBg)}>
                <stat.icon className={cn("h-6 w-6", stat.iconColor)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quickActions.map((action) => {
          const isPrimary = action.variant === "primary";
          const isEmerald = action.variant === "outline-emerald";
          return (
            <button
              key={action.title}
              onClick={() => navigate(action.path)}
              className={cn(
                "p-6 rounded-xl text-left transition-all duration-200 shadow-sm hover:shadow-md border-2",
                isPrimary && "bg-primary border-primary text-white hover:bg-primary/90 hover:border-primary/90",
                action.variant === "outline" && "bg-white border-slate-200 text-slate-900 hover:border-primary hover:bg-primary/5",
                isEmerald && "bg-white border-slate-200 text-slate-900 hover:border-emerald-500 hover:bg-emerald-50"
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-2 rounded-lg",
                  isPrimary ? "bg-white/20" : isEmerald ? "bg-emerald-50" : "bg-slate-100"
                )}>
                  <action.icon className={cn(
                    "h-5 w-5",
                    isPrimary ? "text-white" : isEmerald ? "text-emerald-600" : "text-slate-700"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "font-semibold text-sm",
                    isPrimary ? "text-white" : "text-slate-900"
                  )}>
                    {action.title}
                  </h3>
                  <p className={cn(
                    "text-xs mt-1",
                    isPrimary ? "text-white/90" : "text-slate-600"
                  )}>
                    {action.description}
                  </p>
                </div>
                <ArrowUpRight className={cn(
                  "h-4 w-4 shrink-0",
                  isPrimary ? "text-white/70" : "text-slate-600"
                )} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card title="Revenue Overview" subtitle="Last 7 days performance" className="lg:col-span-2">
          <div className="h-[300px] min-h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(value) => `₹${Number(value).toLocaleString()}`}
                  domain={[0, revenueMax]}
                  allowDataOverflow
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#334155",
                  }}
                  formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Revenue"]}
                  labelFormatter={(label) => `Day: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Product Performance */}
        <Card title="Top Categories" subtitle="Sales by category">
          <div className="h-[300px] min-h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsData?.categoryMix || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="subject"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#334155",
                  }}
                />
                <Bar dataKey="A" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Purchase Orders */}
      <Card
        title="Recent Purchase Orders"
        subtitle="Latest procurement requests from Hub"
        actions={
          <button
            onClick={() => navigate("/seller/procurement")}
            className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1"
          >
            View All
            <ArrowUpRight className="h-4 w-4" />
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  PR ID
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Destination
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Items
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentPRs.map((pr) => (
                <tr key={pr._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 align-middle">
                    <span className="text-sm font-semibold text-slate-900">{pr.requestId}</span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                        H
                      </div>
                      <span className="text-sm font-medium text-slate-700">Central Hub</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <span className="text-sm text-slate-600">{new Date(pr.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <span className="text-xs font-medium text-slate-600">
                      {pr.product || (Array.isArray(pr.items) && pr.items.length > 0 ? pr.items[0].productName : "Products")}
                    </span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <span className="text-sm font-semibold text-slate-900">₹{(pr.unitCost * pr.quantity).toFixed(2)}</span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <Badge variant={getStatusColor(pr.status)} className="capitalize">
                      {pr.status?.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                </tr>
              ))}
              {recentPRs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                    No recent purchase orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
