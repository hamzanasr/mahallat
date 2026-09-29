"use client";

import React, { useEffect, useState } from "react";
import { UserX, Clock, CheckCircle2, XCircle, Search, RefreshCw } from "lucide-react";
import { useLanguage } from "../../../context/LanguageContext";
import { supabase } from "../../../lib/supabase";

interface DeletionRequest {
  id: string;
  user_id: string;
  phone: string;
  reason: string | null;
  acknowledged_forfeiture: boolean;
  status: "pending" | "approved" | "rejected" | "completed";
  rejection_reason: string | null;
  created_at: string;
  user_name?: string;
}

export default function AccountDeletionsPage() {
  const { language: lang } = useLanguage();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("account_deletion_requests")
        .select(`
          id,
          user_id,
          phone,
          reason,
          acknowledged_forfeiture,
          status,
          rejection_reason,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (!error && data) {
        // جلب أسماء العملاء
        const userIds = Array.from(new Set(data.map((d: any) => d.user_id)));
        const profileMap: Record<string, string> = {};

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);

          if (profiles) {
            for (const p of profiles) {
              profileMap[p.id] = p.full_name;
            }
          }
        }

        const formatted = data.map((d: any) => ({
          ...d,
          user_name: profileMap[d.user_id] || "—",
        }));

        setRequests(formatted);
      }
    } catch (err) {
      console.error("Error loading account deletion requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.phone?.toLowerCase().includes(query) ||
      r.user_name?.toLowerCase().includes(query) ||
      r.reason?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            {lang === "ar" ? "جديد (معلق)" : "Pending"}
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {lang === "ar" ? "مكتمل الحذف" : "Completed"}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            {lang === "ar" ? "مرفوض" : "Rejected"}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
              <UserX className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {lang === "ar" ? "طلبات حذف الحساب (CUS-001)" : "Account Deletion Requests"}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {lang === "ar"
                  ? "سجل طلبات حذف الحسابات المقدمة من العملاء عبر التطبيق مع إقرار إسقاط الأرصدة (للقراءة حالياً)"
                  : "Customer account deletion requests with forfeiture acknowledgement (Read-only)"}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadRequests}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {lang === "ar" ? "تحديث" : "Refresh"}
        </button>
      </div>

      {/* شريط البحث والفلاتر */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === "ar" ? "بحث برقم الجوال أو اسم العميل..." : "Search by phone or name..."
            }
            className="w-full ps-9 pe-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">
            {lang === "ar" ? "الحالة:" : "Status:"}
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
          >
            <option value="all">{lang === "ar" ? "جميع الحالات" : "All"}</option>
            <option value="pending">{lang === "ar" ? "معلقة (جديدة)" : "Pending"}</option>
            <option value="completed">{lang === "ar" ? "مكتملة" : "Completed"}</option>
            <option value="rejected">{lang === "ar" ? "مرفوضة" : "Rejected"}</option>
          </select>
        </div>
      </div>

      {/* جدول الطلبات */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3 text-start">
                  {lang === "ar" ? "وقت الطلب" : "Request Time"}
                </th>
                <th className="px-4 py-3 text-start">
                  {lang === "ar" ? "اسم العميل" : "Customer Name"}
                </th>
                <th className="px-4 py-3 text-start">
                  {lang === "ar" ? "رقم الجوال" : "Phone"}
                </th>
                <th className="px-4 py-3 text-start">
                  {lang === "ar" ? "إقرار سقوط الرصيد" : "Forfeiture Acknowledged"}
                </th>
                <th className="px-4 py-3 text-start">
                  {lang === "ar" ? "السبب المذكور" : "Reason"}
                </th>
                <th className="px-4 py-3 text-start">
                  {lang === "ar" ? "الحالة" : "Status"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                    {lang === "ar" ? "جاري تحميل الطلبات..." : "Loading requests..."}
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <UserX className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {lang === "ar" ? "لا توجد طلبات حذف حساب حالياً" : "No deletion requests found"}
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                      {new Date(req.created_at).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {req.user_name}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-700 dir-ltr text-start">
                      {req.phone}
                    </td>
                    <td className="px-4 py-3.5">
                      {req.acknowledged_forfeiture ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {lang === "ar" ? "مقر بسقوط الرصيد" : "Acknowledged"}
                        </span>
                      ) : (
                        <span className="text-xs text-rose-600 font-medium">
                          {lang === "ar" ? "لم يُقر" : "No"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                      {req.reason || "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getStatusBadge(req.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
