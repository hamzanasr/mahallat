"use client";

import React from "react";
import Link from "next/link";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  MapPin,
  Sliders,
  ShieldAlert,
  UserPlus,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function AdminOverviewPage() {
  const { user, primaryRole, isSupport } = useAdminAuth();
  const { t, isRTL } = useLanguage();

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* الترويسة والترحيب */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-900 border border-blue-900/40 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>منصة محلات · الخطوة 1.4 جاهزة ومفعلة بوضع الديمو</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            مرحباً، {user?.user_metadata?.full_name || user?.email}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            لوحة الإدارة المركزية: التحكم الآمن بالمدن، الإعدادات المرنة، سجل التدقيق المحمي، وصلاحيات الموظفين.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300">
            <span className="text-slate-500 block text-[10px]">مستوى الأمان الحالي</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
              <span>تحقق بخطوتين مؤكد (AAL2)</span>
            </span>
          </div>
        </div>
      </div>

      {/* بطاقات التنقل السريع */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* المدن والزونات */}
        <Link
          href="/admin/cities"
          className="group p-5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl shadow-lg transition duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1 group-hover:text-blue-400 transition">
              {t.admin.cities.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              إدارة نطاقات المدن الجغرافية ومضلعات التوصيل وفحص شمول النقاط (DSP-002).
            </p>
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-blue-400">
            <span>فتح المدن</span>
            <ArrowIcon className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* الإعدادات المرنة */}
        <Link
          href="/admin/settings"
          className={`group p-5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl shadow-lg transition duration-200 flex flex-col justify-between ${
            isSupport ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1 group-hover:text-emerald-400 transition">
              {t.admin.nav.settings}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              الرسوم، المهل، نسب الضريبة، ومتغيرات الإسناد مع اشتراط سبب التعديل (ADM-034).
            </p>
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <span>فتح الإعدادات</span>
            <ArrowIcon className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* سجل التدقيق */}
        <Link
          href="/admin/audit-log"
          className={`group p-5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl shadow-lg transition duration-200 flex flex-col justify-between ${
            isSupport ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1 group-hover:text-amber-400 transition">
              {t.admin.audit.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              سجل محمي للقراءة فقط يوثّق كل حركة وتعديل والسبب والبيانات قبل وبعد (ADM-002).
            </p>
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-amber-400">
            <span>فتح سجل التدقيق</span>
            <ArrowIcon className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* المستخدمون والدعوات */}
        <Link
          href="/admin/users"
          className="group p-5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-2xl shadow-lg transition duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <UserPlus className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1 group-hover:text-purple-400 transition">
              {t.admin.users.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              دعوة موظفي الإدارة، وتعيين الأدوار والنطاقات الجغرافية (ADM-001).
            </p>
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-purple-400">
            <span>إدارة الموظفين</span>
            <ArrowIcon className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </Link>
      </div>

      {/* لوحة اختبار الديمو والتحقق السريع */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>حالة متطلبات الخطوة 1.4 في وضع الديمو</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
            <span className="font-semibold text-white block">ADM-001 (دخول آمن ومصادقة ثنائية):</span>
            <p className="text-slate-400 leading-relaxed">
              تم إنشاء 4 حسابات ديمو جاهزة بكلمة مرور واحدة (`DemoAdmin123!`) وتم تطبيق فحص AAL2 في RLS لمنع وصول غير
              المصادقين بخطوتين، وحجب الصلاحيات المالية عن موظف الدعم.
            </p>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
            <span className="font-semibold text-white block">ADM-034 (الإعدادات المرنة):</span>
            <p className="text-slate-400 leading-relaxed">
              جميع الإعدادات الـ 44 مهيأة في قاعدة البيانات ومقسمة لتبويبات واضحة مع فرض سبب التعديل ونافذة مقارنة قبل
              وبعد.
            </p>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
            <span className="font-semibold text-white block">ADM-002 (سجل التدقيق):</span>
            <p className="text-slate-400 leading-relaxed">
              جدول التدقيق يسجل كل تعديل تلقائياً، والصفحة للقراءة فقط بدون أزرار تعديل أو حذف لحماية النزاهة.
            </p>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
            <span className="font-semibold text-white block">DSP-002 (المدن والزونات الجغرافية):</span>
            <p className="text-slate-400 leading-relaxed">
              تم تجهيز مدن الرياض وجدة والدمام بمضلعات PostGIS دقيقة، مع محرر مضلعات وأداة فحص الإحداثيات داخل وخارج
              المدينة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
