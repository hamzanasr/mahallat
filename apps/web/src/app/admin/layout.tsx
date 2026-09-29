"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminAuthProvider, useAdminAuth } from "../../context/AdminAuthContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  Bike,
  Users,
  MapPin,
  Sliders,
  ShieldAlert,
  UserPlus,
  BarChart3,
  LogOut,
  ShieldCheck,
  Languages,
} from "lucide-react";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, primaryRole, isSuperAdmin, isOperations, isFinance, isSupport, isAAL2, loading, signOut } =
    useAdminAuth();
  const { t, isRTL, toggleLanguage, language } = useLanguage();

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push("/admin/login");
    }
  }, [user, loading, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // إذا لم يكن مسجلاً
  if (!user) {
    return null;
  }

  // تنبيه التحقق بخطوتين إذا لم يتحقق
  if (!isAAL2) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
          <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-400 mb-3 border border-amber-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">{t.admin.mfaTitle}</h2>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            وفقاً للمتطلب (ADM-001)، يُشترط إكمال التحقق بخطوتين بالكامل للوصول إلى لوحة الإدارة وقاعدة البيانات.
          </p>
          <button
            onClick={() => router.push("/admin/login")}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
          >
            العودة لصفحة الدخول وإكمال التحقق
          </button>
        </div>
      </div>
    );
  }

  // عناصر القائمة الجانبية مع تحديد المتاح وغير المتاح حسب المرحلة والدور
  const navItems = [
    {
      title: t.admin.nav.overview,
      href: "/admin",
      icon: LayoutDashboard,
      active: pathname === "/admin",
      enabled: true,
    },
    {
      title: t.admin.nav.orders,
      href: "/admin/orders",
      icon: ShoppingBag,
      active: pathname.startsWith("/admin/orders"),
      enabled: false,
    },
    {
      title: t.admin.nav.stores,
      href: "/admin/stores",
      icon: Store,
      active: pathname.startsWith("/admin/stores"),
      enabled: false,
    },
    {
      title: t.admin.nav.drivers,
      href: "/admin/drivers",
      icon: Bike,
      active: pathname.startsWith("/admin/drivers"),
      enabled: false,
    },
    {
      title: t.admin.nav.customers,
      href: "/admin/customers",
      icon: Users,
      active: pathname.startsWith("/admin/customers"),
      enabled: false,
    },
    {
      title: t.admin.nav.cities,
      href: "/admin/cities",
      icon: MapPin,
      active: pathname.startsWith("/admin/cities"),
      enabled: isSuperAdmin || isOperations,
    },
    {
      title: t.admin.nav.settings,
      href: "/admin/settings",
      icon: Sliders,
      active: pathname.startsWith("/admin/settings"),
      enabled: isSuperAdmin || isOperations || isFinance, // محجوب عن الدعم
    },
    {
      title: t.admin.nav.auditLog,
      href: "/admin/audit-log",
      icon: ShieldAlert,
      active: pathname.startsWith("/admin/audit-log"),
      enabled: isSuperAdmin || isOperations || isFinance, // محجوب عن الدعم
    },
    {
      title: t.admin.nav.users,
      href: "/admin/users",
      icon: UserPlus,
      active: pathname.startsWith("/admin/users"),
      enabled: isSuperAdmin,
    },
    {
      title: t.admin.nav.reports,
      href: "/admin/reports",
      icon: BarChart3,
      active: pathname.startsWith("/admin/reports"),
      enabled: false,
    },
  ];

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case "super_admin":
        return "المدير العام";
      case "operations":
        return "إدارة العمليات";
      case "finance":
        return "الإدارة المالية";
      case "support":
        return "خدمة العملاء والدعم";
      default:
        return "موظف إداري";
    }
  };

  const getRoleBadgeStyle = (role: string | null) => {
    switch (role) {
      case "super_admin":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "operations":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "finance":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "support":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row" dir={isRTL ? "rtl" : "ltr"}>
      {/* القائمة الجانبية من اليمين (RTL) */}
      <aside className="w-full md:w-64 bg-slate-900/90 border-b md:border-b-0 md:border-l border-slate-800 flex flex-col shrink-0">
        {/* Header اللوجو */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">{t.common.appName}</h1>
              <p className="text-[11px] text-slate-400">{t.admin.title}</p>
            </div>
          </div>
          <button
            onClick={toggleLanguage}
            title={t.common.switchLanguage}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition"
          >
            <Languages className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-mono">{language === "ar" ? "EN" : "ع"}</span>
          </button>
        </div>

        {/* بطاقة المستخدم الحالي */}
        <div className="p-4 mx-3 my-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-white truncate max-w-[140px]">
              {user.user_metadata?.full_name || user.email?.split("@")[0]}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getRoleBadgeStyle(primaryRole)}`}
            >
              {getRoleLabel(primaryRole)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
        </div>

        {/* روابط التنقل */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (!item.enabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-slate-500 cursor-not-allowed select-none opacity-60"
                  title="هذه الصفحة قيد التطوير في المراحل اللاحقة"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-slate-600" />
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {t.admin.nav.comingSoon}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition duration-150 ${
                  item.active
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${item.active ? "text-white" : "text-slate-400"}`} />
                  <span>{item.title}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer القائمة الجانبية: تسجيل الخروج */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.admin.logout}</span>
          </button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-8">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminAuthProvider>
  );
}
