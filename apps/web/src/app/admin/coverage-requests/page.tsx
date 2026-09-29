"use client";

import React, { useEffect, useState } from "react";
import {
  MapPin,
  Calendar,
  Search,
  RefreshCw,
  ExternalLink,
  Navigation,
  Clock,
  User,
  Smartphone,
} from "lucide-react";
import { useLanguage } from "../../../context/LanguageContext";
import { supabase } from "../../../lib/supabase";

interface CoverageRequest {
  id: string;
  latitude: number;
  longitude: number;
  customer_id: string | null;
  device_id: string | null;
  district_name: string | null;
  city_hint: string | null;
  note: string | null;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
}

export default function CoverageRequestsPage() {
  const { language: lang, t } = useLanguage();
  const [requests, setRequests] = useState<CoverageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "7days" | "30days">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("coverage_requests")
        .select(`
          id,
          latitude,
          longitude,
          customer_id,
          device_id,
          district_name,
          city_hint,
          note,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (dateFilter === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte("created_at", today.toISOString());
      } else if (dateFilter === "7days") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        query = query.gte("created_at", d.toISOString());
      } else if (dateFilter === "30days") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        query = query.gte("created_at", d.toISOString());
      }

      const { data, error } = await query;

      if (!error && data) {
        // جلب أسماء العملاء المسجلين
        const customerIds = Array.from(
          new Set(data.map((d: any) => d.customer_id).filter(Boolean))
        );
        const profileMap: Record<string, { name: string; phone: string }> = {};

        if (customerIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", customerIds);

          profiles?.forEach((p: any) => {
            profileMap[p.id] = { name: p.full_name, phone: p.phone };
          });
        }

        const enriched: CoverageRequest[] = data.map((item: any) => ({
          ...item,
          customer_name: item.customer_id ? profileMap[item.customer_id]?.name : undefined,
          customer_phone: item.customer_id ? profileMap[item.customer_id]?.phone : undefined,
        }));

        setRequests(enriched);
      }
    } catch (err) {
      console.error("خطأ في جلب طلبات التغطية:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [dateFilter]);

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.district_name && r.district_name.toLowerCase().includes(q)) ||
      (r.city_hint && r.city_hint.toLowerCase().includes(q)) ||
      (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
      (r.note && r.note.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">
              {t.admin?.coverageRequests?.title || "طلبات التغطية"}
            </h1>
            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
              ADM-033
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t.admin?.coverageRequests?.subtitle ||
              "طلبات واهتمامات العملاء بالمناطق غير المغطاة لإرشاد خطط التوسع"}
          </p>
        </div>

        <button
          onClick={loadRequests}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* شريط الإحصائيات والفلاتر */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">إجمالي الطلبات المسجلة</p>
            <p className="text-xl font-bold text-white mt-1">{requests.length}</p>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Navigation className="w-5 h-5" />
          </div>
        </div>

        {/* فلترة التاريخ */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">الفترة الزمنية:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "جميع الأوقات" },
              { id: "today", label: "اليوم" },
              { id: "7days", label: "آخر 7 أيام" },
              { id: "30days", label: "آخر 30 يوماً" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setDateFilter(btn.id as any)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                  dateFilter === btn.id
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* البحث في الطلبات */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث بالحي، المدينة المقترحة، اسم العميل، أو الملاحظة..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl ps-9 pe-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* جدول الطلبات */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            جاري تحميل طلبات التغطية...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Navigation className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">
              لا توجد طلبات تغطية مطابقة
            </p>
            <p className="text-xs text-slate-500 mt-1">
              عندما يضغط العملاء في المناطق غير المخدومة على زر «أبلغوني» ستظهر نقاطهم هنا مباشرة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold text-start">المنطقة / الحي</th>
                  <th className="py-3 px-4 font-semibold text-start">الإحداثيات الجغرافية</th>
                  <th className="py-3 px-4 font-semibold text-start">العميل / الجهاز</th>
                  <th className="py-3 px-4 font-semibold text-start">التاريخ والوقت</th>
                  <th className="py-3 px-4 font-semibold text-start">الخريطة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">
                        {req.district_name || req.city_hint || "منطقة غير محددة"}
                      </div>
                      {req.note && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{req.note}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-blue-400">
                      {req.latitude.toFixed(5)}, {req.longitude.toFixed(5)}
                    </td>

                    <td className="py-3.5 px-4">
                      {req.customer_name ? (
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <User className="w-3.5 h-3.5 text-blue-400" />
                          <span>{req.customer_name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                          <span>زائر {req.device_id ? `(${req.device_id.slice(0, 8)})` : ""}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{new Date(req.created_at).toLocaleString("ar-SA")}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <a
                        href={`https://www.google.com/maps?q=${req.latitude},${req.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium"
                      >
                        <span>فتح في خرائط Google</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
