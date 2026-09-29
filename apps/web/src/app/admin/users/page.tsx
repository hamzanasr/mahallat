"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import {
  UserPlus,
  Mail,
  Shield,
  MapPin,
  CheckCircle,
  Clock,
  Send,
  AlertCircle,
  Copy,
  Users,
} from "lucide-react";

interface AdminUserRow {
  user_id: string;
  role: string;
  email?: string;
  full_name?: string;
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  city_id: string | null;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
}

export default function AdminUsersPage() {
  const { isSuperAdmin } = useAdminAuth();
  const { t } = useLanguage();

  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);

  // حقول نموذج الدعوة
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("support");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_invitations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (err: any) {
      console.error("خطأ في جلب الدعوات:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadInvitations();
    }
  }, [isSuperAdmin]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage(null);

    try {
      const { error } = await supabase.from("admin_invitations").insert({
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole as any,
        status: "pending",
      });

      if (error) throw error;

      setMessage({ type: "success", text: `تم إنشاء دعوة بنجاح للبريد (${inviteEmail}) بدور (${inviteRole})` });
      setInviteEmail("");
      await loadInvitations();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "حدث خطأ أثناء إرسال الدعوة" });
    } finally {
      setSending(false);
    }
  };

  const getRoleLabel = (role: string) => {
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
        return role;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* الترويسة */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <span>{t.admin.users.title}</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          إدارة موظفي المنصة وإرسال الدعوات المشفرة وتحديد الأدوار الإدارية طبقاً للمتطلب (ADM-001).
        </p>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-200"
              : "bg-red-950/60 border-red-800/60 text-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* قسم دعوة موظف جديد */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-purple-400" />
          <span>{t.admin.users.inviteButton}</span>
        </h2>

        <form onSubmit={handleSendInvite} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1.5">{t.admin.users.invitedEmail}</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="employee@mahallat.sa"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5">{t.admin.users.assignedRole}</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="operations">إدارة العمليات (Operations)</option>
              <option value="finance">الإدارة المالية (Finance)</option>
              <option value="support">خدمة العملاء والدعم (Support - ممنوع مالياً)</option>
              <option value="super_admin">مدير عام (Super Admin)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={sending}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? "جاري الإرسال..." : t.admin.users.sendInvite}</span>
            </button>
          </div>
        </form>
      </div>

      {/* قائمة الدعوات المعلقة والنشطة */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800">
          <span className="text-xs font-semibold text-white">سجل الدعوات الصادرة ({invitations.length})</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">جاري تحميل الدعوات...</div>
        ) : invitations.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">لا توجد دعوات مسجلة حتى الآن.</div>
        ) : (
          <div className="divide-y divide-slate-800/60 text-xs">
            {invitations.map((inv) => (
              <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-white">{inv.email}</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px]">
                      {getRoleLabel(inv.role)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    الرمز السري: {inv.token.substring(0, 16)}...
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-medium">
                    {inv.status === "pending" ? "بانتظار قبول الموظف" : inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
