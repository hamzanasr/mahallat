"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../context/LanguageContext";
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Store,
  DollarSign,
  Search,
  Filter,
} from "lucide-react";

interface ReviewRequestItem {
  id: string;
  store_id: string;
  item_id: string;
  change_type: string;
  old_price_halalas: number | null;
  proposed_price_halalas: number;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  store?: { name_ar: string; name_en: string };
  item?: { name_ar: string; name_en: string };
}

export default function AdminMerchantReviewsPage() {
  const { t, isRTL } = useLanguage();
  const [requests, setRequests] = useState<ReviewRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // مودال الرفض مع سبب إلزامي (MER-002)
  const [selectedReqForReject, setSelectedReqForReject] = useState<ReviewRequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("menu_review_requests")
        .select(`
          id,
          store_id,
          item_id,
          change_type,
          old_price_halalas,
          proposed_price_halalas,
          status,
          rejection_reason,
          created_at,
          reviewed_at,
          store:stores(name_ar, name_en),
          item:menu_items(name_ar, name_en)
        `)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests((data as unknown as ReviewRequestItem[]) || []);
    } catch (e: any) {
      console.error(e);
      setFeedbackMsg({ type: "error", text: e.message || "تعذر تحميل طلبات المراجعة" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filterStatus]);

  const handleApprove = async (req: ReviewRequestItem) => {
    try {
      setSubmittingAction(true);
      setFeedbackMsg(null);

      const { data, error } = await supabase.rpc("review_menu_change_request", {
        p_request_id: req.id,
        p_action: "approve",
      });

      if (error) throw error;

      setFeedbackMsg({
        type: "success",
        text: `✓ تم اعتماد تعديل السعر إلى ${(req.proposed_price_halalas / 100).toFixed(2)} ر.س وتطبيقه فوراً على الصنف`,
      });
      await fetchRequests();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "فشل اعتماد الطلب" });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReqForReject) return;
    if (!rejectionReason.trim()) {
      setFeedbackMsg({ type: "error", text: "سبب الرفض إلزامي عند رفض طلب تعديل المنيو (MER-002)" });
      return;
    }

    try {
      setSubmittingAction(true);
      setFeedbackMsg(null);

      const { data, error } = await supabase.rpc("review_menu_change_request", {
        p_request_id: selectedReqForReject.id,
        p_action: "reject",
        p_rejection_reason: rejectionReason.trim(),
      });

      if (error) throw error;

      setSelectedReqForReject(null);
      setRejectionReason("");
      setFeedbackMsg({
        type: "success",
        text: "تم رفض الطلب بنجاح وتوثيق سبب الرفض في سجل التدقيق (MER-002)",
      });
      await fetchRequests();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "فشل رفض الطلب" });
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-blue-500" />
            {t.admin.reviews.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">{t.admin.reviews.subtitle}</p>
        </div>

        {/* فلترة الحالات */}
        <div className="flex items-center gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filterStatus === status
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {status === "pending"
                ? "قيد المراجعة"
                : status === "approved"
                ? "المقبولة"
                : status === "rejected"
                ? "المرفوضة"
                : "الكل"}
            </button>
          ))}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            feedbackMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {feedbackMsg.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* جدول الطلبات */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          {t.common.loading}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <ClipboardCheck className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white mb-1">{t.admin.reviews.noPending}</h3>
          <p className="text-xs text-slate-400">لا توجد طلبات في هذه الحالة حالياً</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium">
                <tr>
                  <th className="py-3 px-4 text-start">المتجر</th>
                  <th className="py-3 px-4 text-start">الصنف</th>
                  <th className="py-3 px-4 text-start">السعر السابق</th>
                  <th className="py-3 px-4 text-start">السعر المقترح</th>
                  <th className="py-3 px-4 text-start">فارق النسبة</th>
                  <th className="py-3 px-4 text-start">الحالة</th>
                  <th className="py-3 px-4 text-end">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {requests.map((req) => {
                  const oldP = (req.old_price_halalas || 0) / 100;
                  const newP = req.proposed_price_halalas / 100;
                  const diffPct = oldP > 0 ? (((newP - oldP) / oldP) * 100).toFixed(1) : "جديد";

                  return (
                    <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white block">{req.store?.name_ar || "متجر"}</span>
                        <span className="text-[10px] text-slate-400">{req.store?.name_en}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-200 block">{req.item?.name_ar || "صنف"}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(req.created_at).toLocaleString("ar-SA")}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-400">{oldP > 0 ? `${oldP.toFixed(2)} ر.س` : "—"}</td>

                      <td className="py-3 px-4 font-mono font-bold text-white">{newP.toFixed(2)} ر.س</td>

                      <td className="py-3 px-4 font-mono text-xs">
                        <span
                          className={
                            typeof diffPct === "string" && diffPct.startsWith("-")
                              ? "text-emerald-400"
                              : "text-amber-400 font-semibold"
                          }
                        >
                          {diffPct}%
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            req.status === "pending"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : req.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}
                        >
                          {req.status === "pending"
                            ? "قيد المراجعة"
                            : req.status === "approved"
                            ? "تم الاعتماد"
                            : "مرفوض"}
                        </span>
                        {req.status === "rejected" && req.rejection_reason && (
                          <span className="text-[10px] text-red-300 block mt-0.5 max-w-xs truncate" title={req.rejection_reason}>
                            السبب: {req.rejection_reason}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-end">
                        {req.status === "pending" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={submittingAction}
                              onClick={() => handleApprove(req)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {t.admin.reviews.approve}
                            </button>

                            <button
                              disabled={submittingAction}
                              onClick={() => {
                                setSelectedReqForReject(req);
                                setRejectionReason("");
                              }}
                              className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {t.admin.reviews.reject}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">تم البت بالطلب</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مودال الرفض مع سبب إلزامي (MER-002) */}
      {selectedReqForReject && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              رفض طلب تعديل السعر (MER-002)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              وفقاً للمتطلب (MER-002)، لا يمكن رفض طلب تعديل منيو بدون سبب واضح، وسيظهر هذا السبب للتاجر ويُسجل في سجل التدقيق.
            </p>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
              <div>
                <span className="text-slate-400">الصنف: </span>
                <span className="font-semibold text-white">{selectedReqForReject.item?.name_ar}</span>
              </div>
              <div>
                <span className="text-slate-400">السعر المقترح: </span>
                <span className="font-mono text-white">
                  {(selectedReqForReject.proposed_price_halalas / 100).toFixed(2)} ر.س
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-slate-300 font-medium">سبب الرفض (إلزامي) *</label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="اكتب سبب الرفض بالتفصيل (مثال: السعر لا يطابق أسعار المحل المعتمدة وفق الشروط)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedReqForReject(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submittingAction || !rejectionReason.trim()}
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                تأكيد الرفض مع السبب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
