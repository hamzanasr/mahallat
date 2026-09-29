"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import {
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  User,
  Activity,
  FileText,
  Clock,
  Eye,
  Lock,
  ChevronDown,
  X,
} from "lucide-react";

interface AuditEntry {
  id: number;
  actor_id: string | null;
  table_name: string;
  record_id: string;
  action: string;
  old_data: any;
  new_data: any;
  reason: string | null;
  created_at: string;
}

export default function AdminAuditLogPage() {
  const { isSupport } = useAdminAuth();
  const { t, isRTL } = useLanguage();

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }
      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as any) || []);
    } catch (err) {
      console.error("خطأ في جلب سجل التدقيق:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupport) {
      fetchLogs();
    }
  }, [tableFilter, actionFilter, isSupport]);

  // تصفية إضافية بالبحث
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.record_id.toLowerCase().includes(q) ||
      log.table_name.toLowerCase().includes(q) ||
      (log.reason && log.reason.toLowerCase().includes(q))
    );
  });

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case "INSERT":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "UPDATE":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "DELETE":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("ar-SA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(d);
    } catch {
      return isoString;
    }
  };

  if (isSupport) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-3 border border-red-500/20">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-white mb-2">وصول محجوب</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          وفقاً للمتطلب (ADM-001)، موظف الدعم غير مصرح له بالاطلاع على سجلات التدقيق أو العمليات الحساسة.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* الترويسة والتنبيه */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>{t.admin.audit.title}</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              سجل تدقيق أمني غير قابل للتعديل أو الحذف (Append-Only) وفقاً للمتطلب (ADM-002).
            </p>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            <span>محمي: لا يمكن الحذف أو التعديل</span>
          </div>
        </div>

        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400">
          {t.admin.audit.readOnlyNotice}
        </div>
      </div>

      {/* شريط الفلاتر والبحث */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
        {/* بحث */}
        <div className="relative flex-1 min-w-[220px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.admin.audit.searchPlaceholder}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
        </div>

        {/* تصفية الجدول */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">كافة الجداول</option>
            <option value="setting_values">الإعدادات (setting_values)</option>
            <option value="cities">المدن (cities)</option>
            <option value="zones">الزونات (zones)</option>
            <option value="user_roles">الأدوار (user_roles)</option>
            <option value="stores">المتاجر (stores)</option>
          </select>
        </div>

        {/* تصفية العملية */}
        <div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">كافة العمليات</option>
            <option value="INSERT">إضافة (INSERT)</option>
            <option value="UPDATE">تعديل (UPDATE)</option>
            <option value="DELETE">حذف (DELETE)</option>
          </select>
        </div>
      </div>

      {/* جدول سجل التدقيق */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <span>جاري تحميل سجل التدقيق...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            {t.admin.audit.noRecords}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">{t.admin.audit.timestamp}</th>
                  <th className="py-3 px-4 font-semibold">{t.admin.audit.action}</th>
                  <th className="py-3 px-4 font-semibold">{t.admin.audit.table}</th>
                  <th className="py-3 px-4 font-semibold">{t.admin.audit.recordId}</th>
                  <th className="py-3 px-4 font-semibold">{t.admin.audit.reason}</th>
                  <th className="py-3 px-4 font-semibold text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${getActionBadge(
                          entry.action
                        )}`}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{entry.table_name}</td>
                    <td className="py-3 px-4 font-mono text-blue-400 max-w-[120px] truncate" title={entry.record_id}>
                      {entry.record_id}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate" title={entry.reason || "-"}>
                      {entry.reason || <span className="text-slate-600">-</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>عرض الفروقات</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة تفاصيل السجل والفروقات قبل وبعد (Diff Details Modal) */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${getActionBadge(selectedEntry.action)}`}>
                  {selectedEntry.action}
                </span>
                <span className="font-bold text-white text-sm">
                  {selectedEntry.table_name} #{selectedEntry.record_id}
                </span>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px]">الوقت والتاريخ:</span>
                <span className="text-slate-200 font-mono">{formatDate(selectedEntry.created_at)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">المنفذ (Actor ID):</span>
                <span className="text-slate-200 font-mono truncate block">{selectedEntry.actor_id || "System"}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-800/60">
                <span className="text-slate-500 block text-[10px]">سبب التعديل المسجل:</span>
                <span className="text-amber-300 font-medium">{selectedEntry.reason || "لم يُحدد"}</span>
              </div>
            </div>

            {/* مقارنة قبل وبعد */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-400">{t.admin.audit.before}:</span>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-red-300 overflow-x-auto max-h-60">
                  {selectedEntry.old_data ? JSON.stringify(selectedEntry.old_data, null, 2) : "لا توجد بيانات سابقة"}
                </pre>
              </div>

              <div className="space-y-1.5">
                <span className="font-semibold text-slate-400">{t.admin.audit.after}:</span>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-60">
                  {selectedEntry.new_data ? JSON.stringify(selectedEntry.new_data, null, 2) : "تم الحذف"}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
