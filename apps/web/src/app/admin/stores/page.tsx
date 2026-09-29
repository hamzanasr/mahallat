"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../context/LanguageContext";
import {
  Store,
  Plus,
  Search,
  Building2,
  Clock,
  Shield,
  Percent,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronRight,
  Filter,
} from "lucide-react";

interface StoreItem {
  id: string;
  merchant_id: string;
  name_ar: string;
  name_en: string;
  store_type: "contracted_menu" | "contracted_text_only" | "uncontracted";
  operation_type: "restaurant" | "retail" | "mart" | "pharmacy";
  city_id: string;
  min_order_halalas: number;
  default_prep_time_minutes: number;
  can_exceed_max_prep_time: boolean;
  menu_permission: "full" | "price_tolerance" | "review_required";
  menu_price_tolerance_percentage: number;
  menu_slug: string;
  created_at: string;
  city?: { name_ar: string; name_en: string };
  merchant?: { commercial_name: string };
  category?: { name_ar: string; name_en: string };
}

export default function AdminStoresPage() {
  const { t, isRTL } = useLanguage();
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperation, setFilterOperation] = useState<string>("all");
  const [filterStoreType, setFilterStoreType] = useState<string>("all");

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("stores")
        .select(`
          id,
          merchant_id,
          name_ar,
          name_en,
          store_type,
          operation_type,
          city_id,
          min_order_halalas,
          default_prep_time_minutes,
          can_exceed_max_prep_time,
          menu_permission,
          menu_price_tolerance_percentage,
          menu_slug,
          created_at,
          city:cities(name_ar, name_en),
          merchant:merchants(commercial_name),
          category:store_categories(name_ar, name_en)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching stores:", error);
      } else {
        setStores((data as unknown as StoreItem[]) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const getStoreTypeLabel = (type: string) => {
    switch (type) {
      case "contracted_menu":
        return { label: "متعاقد بمنيو", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
      case "contracted_text_only":
        return { label: "متعاقد كتابة فقط", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
      case "uncontracted":
        return { label: "غير متعاقد (اطلب اللي تبي)", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
      default:
        return { label: type, color: "bg-slate-800 text-slate-300 border-slate-700" };
    }
  };

  const getOperationTypeLabel = (op: string) => {
    switch (op) {
      case "restaurant":
        return "مطاعم";
      case "retail":
        return "محلات متنوعة";
      case "mart":
        return "مارت";
      case "pharmacy":
        return "صيدليات";
      default:
        return op;
    }
  };

  const getMenuPermissionLabel = (perm: string, tolPct: number) => {
    switch (perm) {
      case "full":
        return "صلاحية كاملة";
      case "price_tolerance":
        return `سماح حتى ${tolPct}%`;
      case "review_required":
        return "بالمراجعة";
      default:
        return perm;
    }
  };

  const filteredStores = stores.filter((s) => {
    const matchesSearch =
      s.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.menu_slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.merchant?.commercial_name && s.merchant.commercial_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesOp = filterOperation === "all" || s.operation_type === filterOperation;
    const matchesType = filterStoreType === "all" || s.store_type === filterStoreType;

    return matchesSearch && matchesOp && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* رأس الصفحة وأزرار الإجراءات */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Store className="w-6 h-6 text-blue-500" />
            {t.admin.stores.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة المتاجر والفروع وقوائم المنتجات والمنيو وصلاحيات الأسعار والعقود
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/stores/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            {t.admin.stores.addStore}
          </Link>
        </div>
      </div>

      {/* شريط البحث والفلترة */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.admin.stores.searchPlaceholder}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>فلترة:</span>
          </div>

          <select
            value={filterOperation}
            onChange={(e) => setFilterOperation(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">كل أقسام التشغيل</option>
            <option value="restaurant">مطاعم</option>
            <option value="retail">محلات متنوعة</option>
            <option value="mart">مارت</option>
            <option value="pharmacy">صيدليات</option>
          </select>

          <select
            value={filterStoreType}
            onChange={(e) => setFilterStoreType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">كل أنواع المتاجر</option>
            <option value="contracted_menu">متعاقد بمنيو</option>
            <option value="contracted_text_only">متعاقد كتابة فقط</option>
            <option value="uncontracted">غير متعاقد</option>
          </select>
        </div>
      </div>

      {/* قائمة المتاجر */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          {t.common.loading}
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-500">
            <Store className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">لا توجد متاجر مسجلة</h3>
          <p className="text-xs text-slate-400 mb-4">ابدأ بإضافة أول متجر أو غيّر معايير البحث والفلترة</p>
          <Link
            href="/admin/stores/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            {t.admin.stores.addStore}
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium">
                <tr>
                  <th className="py-3 px-4 text-start">المتجر</th>
                  <th className="py-3 px-4 text-start">المنشأة (التاجر)</th>
                  <th className="py-3 px-4 text-start">نوع المتجر والتشغيل</th>
                  <th className="py-3 px-4 text-start">المدينة</th>
                  <th className="py-3 px-4 text-start">التحضير والحد الأدنى</th>
                  <th className="py-3 px-4 text-start">صلاحية المنيو</th>
                  <th className="py-3 px-4 text-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredStores.map((store) => {
                  const typeBadge = getStoreTypeLabel(store.store_type);
                  return (
                    <tr key={store.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">
                            {store.name_ar.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-white text-xs">{store.name_ar}</div>
                            <div className="text-[10px] text-slate-400">{store.name_en}</div>
                            <div className="text-[10px] text-blue-400/80 font-mono mt-0.5">/{store.menu_slug}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{store.merchant?.commercial_name || "—"}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border w-max ${typeBadge.color}`}
                          >
                            {typeBadge.label}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {getOperationTypeLabel(store.operation_type)}
                            {store.category ? ` · ${store.category.name_ar}` : ""}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-300">{store.city?.name_ar || "—"}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5 text-[11px]">
                          <span className="text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {store.default_prep_time_minutes} د
                            {store.can_exceed_max_prep_time && (
                              <span className="text-[9px] text-amber-400 font-semibold" title="مسموح بتجاوز 40 دقيقة (MER-040)">
                                (استثناء)
                              </span>
                            )}
                          </span>
                          <span className="text-slate-400">
                            أدنى: {(store.min_order_halalas / 100).toFixed(2)} ر.س
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-[11px]">
                          <span className="text-slate-300 font-medium">
                            {getMenuPermissionLabel(store.menu_permission, store.menu_price_tolerance_percentage)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-end">
                        <Link
                          href={`/admin/stores/${store.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                        >
                          <span>إدارة المتجر</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
