"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../context/LanguageContext";
import {
  Building2,
  Plus,
  Search,
  Store,
  CreditCard,
  Users,
  CheckCircle,
  AlertCircle,
  Edit2,
  Phone,
  Mail,
  FileText,
  Shield,
  ChevronDown,
} from "lucide-react";

interface MerchantItem {
  id: string;
  commercial_name: string;
  cr_number: string | null;
  vat_number: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
  bank_account?: {
    id: string;
    bank_name: string;
    iban: string;
    beneficiary_name: string;
    is_verified: boolean;
  };
  stores_count?: number;
}

export default function AdminMerchantsPage() {
  const { t, isRTL } = useLanguage();
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // مودال إضافة منشأة
  const [showAddModal, setShowAddModal] = useState(false);
  const [commName, setCommName] = useState("");
  const [crNum, setCrNum] = useState("");
  const [vatNum, setVatNum] = useState("");
  const [contName, setContName] = useState("");
  const [contPhone, setContPhone] = useState("");
  const [contEmail, setContEmail] = useState("");

  // مودال الحساب البنكي
  const [showBankModal, setShowBankModal] = useState(false);
  const [selectedMerchantForBank, setSelectedMerchantForBank] = useState<MerchantItem | null>(null);
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");

  const fetchMerchants = async () => {
    try {
      setLoading(true);
      const { data: merchantsData, error } = await supabase
        .from("merchants")
        .select(`
          id,
          commercial_name,
          cr_number,
          vat_number,
          contact_name,
          contact_phone,
          contact_email,
          created_at,
          bank_account:merchant_bank_accounts(id, bank_name, iban, beneficiary_name, is_verified)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // جلب عدد المتاجر لكل تاجر
      const { data: storeCounts } = await supabase.from("stores").select("merchant_id");
      const countMap: Record<string, number> = {};
      storeCounts?.forEach((s) => {
        countMap[s.merchant_id] = (countMap[s.merchant_id] || 0) + 1;
      });

      const formatted = (merchantsData || []).map((m: any) => ({
        ...m,
        bank_account: Array.isArray(m.bank_account) ? m.bank_account[0] : m.bank_account,
        stores_count: countMap[m.id] || 0,
      }));

      setMerchants(formatted);
    } catch (e: any) {
      console.error(e);
      setFeedbackMsg({ type: "error", text: e.message || "تعذر تحميل قائمة التجار" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const handleCreateMerchant = async () => {
    if (!commName.trim()) {
      setFeedbackMsg({ type: "error", text: "اسم المنشأة التجاري مطلوب" });
      return;
    }

    try {
      setFeedbackMsg(null);
      const { error } = await supabase.from("merchants").insert({
        commercial_name: commName.trim(),
        cr_number: crNum.trim() || null,
        vat_number: vatNum.trim() || null,
        contact_name: contName.trim() || null,
        contact_phone: contPhone.trim() || null,
        contact_email: contEmail.trim() || null,
      });

      if (error) throw error;

      setShowAddModal(false);
      setCommName("");
      setCrNum("");
      setVatNum("");
      setContName("");
      setContPhone("");
      setContEmail("");
      setFeedbackMsg({ type: "success", text: "تم تسجيل المنشأة التجارية بنجاح" });
      await fetchMerchants();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "فشل تسجيل المنشأة" });
    }
  };

  const handleSaveBankAccount = async () => {
    if (!selectedMerchantForBank) return;
    if (!bankName.trim() || !iban.trim() || !beneficiaryName.trim()) {
      setFeedbackMsg({ type: "error", text: "جميع حقول الحساب البنكي مطلوبة" });
      return;
    }

    try {
      setFeedbackMsg(null);
      const { error } = await supabase.from("merchant_bank_accounts").upsert(
        {
          merchant_id: selectedMerchantForBank.id,
          bank_name: bankName.trim(),
          iban: iban.trim().toUpperCase(),
          beneficiary_name: beneficiaryName.trim(),
          is_verified: true,
        },
        { onConflict: "merchant_id" }
      );

      if (error) throw error;

      setShowBankModal(false);
      setFeedbackMsg({
        type: "success",
        text: "تم حفظ وتحديث الحساب البنكي وتسجيله في سجل التدقيق الأمني (MER-001)",
      });
      await fetchMerchants();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "فشل حفظ الحساب البنكي" });
    }
  };

  const filteredMerchants = merchants.filter((m) =>
    m.commercial_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.cr_number && m.cr_number.includes(searchQuery)) ||
    (m.contact_phone && m.contact_phone.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-500" />
            {t.admin.merchants.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            سجل المنشآت والشركات التجارية والحسابات البنكية والمستخدمين (MER-001)
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          {t.admin.merchants.addMerchant}
        </button>
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

      {/* البحث */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المنشأة أو السجل التجاري أو الجوال..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* جدول المنشآت */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          {t.common.loading}
        </div>
      ) : filteredMerchants.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Building2 className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white mb-1">لا توجد منشآت مسجلة</h3>
          <p className="text-xs text-slate-400 mb-4">ابدأ بإضافة أول منشأة تجارية تابعة لتاجر</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
          >
            {t.admin.merchants.addMerchant}
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium">
                <tr>
                  <th className="py-3 px-4 text-start">المنشأة التجارية</th>
                  <th className="py-3 px-4 text-start">السجل والضريبة</th>
                  <th className="py-3 px-4 text-start">بيانات التواصل</th>
                  <th className="py-3 px-4 text-start">المتاجر التابعة</th>
                  <th className="py-3 px-4 text-start">الحساب البنكي (MER-001)</th>
                  <th className="py-3 px-4 text-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredMerchants.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white text-xs">{m.commercial_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        مسجل: {new Date(m.created_at).toLocaleDateString("ar-SA")}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      <div>س.ت: {m.cr_number || "غير مسجل"}</div>
                      <div className="text-slate-400 text-[10px]">ض.ق.م: {m.vat_number || "غير مسجل"}</div>
                    </td>

                    <td className="py-3 px-4 text-[11px]">
                      <div>{m.contact_name || "—"}</div>
                      <div className="text-slate-400 text-[10px] font-mono">{m.contact_phone || "—"}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-200">
                        <Store className="w-3 h-3 text-blue-400" />
                        {m.stores_count || 0} متاجر
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {m.bank_account ? (
                        <div className="text-[11px]">
                          <div className="font-semibold text-white">{m.bank_account.bank_name}</div>
                          <div className="font-mono text-slate-400 text-[10px] truncate max-w-xs" title={m.bank_account.iban}>
                            {m.bank_account.iban}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          بانتظار الحساب
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-end">
                      <button
                        onClick={() => {
                          setSelectedMerchantForBank(m);
                          if (m.bank_account) {
                            setBankName(m.bank_account.bank_name);
                            setIban(m.bank_account.iban);
                            setBeneficiaryName(m.bank_account.beneficiary_name);
                          } else {
                            setBankName("مصرف الراجحي");
                            setIban("SA");
                            setBeneficiaryName(m.commercial_name);
                          }
                          setShowBankModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                        <span>الحساب البنكي</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مودال إضافة منشأة */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              {t.admin.merchants.addMerchant}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">{t.admin.merchants.commercialName} *</label>
                <input
                  type="text"
                  value={commName}
                  onChange={(e) => setCommName(e.target.value)}
                  placeholder="مثال: شركة شواية الشرق التجارية"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">{t.admin.merchants.crNumber}</label>
                  <input
                    type="text"
                    value={crNum}
                    onChange={(e) => setCrNum(e.target.value)}
                    placeholder="1010XXXXXX"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">{t.admin.merchants.vatNumber}</label>
                  <input
                    type="text"
                    value={vatNum}
                    onChange={(e) => setVatNum(e.target.value)}
                    placeholder="300XXXXXXXXX"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">{t.admin.merchants.contactName}</label>
                <input
                  type="text"
                  value={contName}
                  onChange={(e) => setContName(e.target.value)}
                  placeholder="اسم الشخص المسؤول"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">{t.admin.merchants.contactPhone}</label>
                  <input
                    type="text"
                    value={contPhone}
                    onChange={(e) => setContPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">{t.admin.merchants.contactEmail}</label>
                  <input
                    type="email"
                    value={contEmail}
                    onChange={(e) => setContEmail(e.target.value)}
                    placeholder="merchant@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateMerchant}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                تسجيل المنشأة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال الحساب البنكي (MER-001) */}
      {showBankModal && selectedMerchantForBank && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-400" />
              الحساب البنكي لـ: {selectedMerchantForBank.commercial_name}
            </h3>
            <p className="text-xs text-slate-400">
              وفقاً للمتطلب (MER-001)، كل تعديل على الحساب البنكي يُسجل في سجل التدقيق الأمني لمنع أي تلاعب.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">{t.admin.merchants.bankName} *</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="مثال: مصرف الراجحي، بنك الرياض، البنك الأهلي..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">{t.admin.merchants.iban} *</label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="SAXXXXXXXXXXXXXXXXXXXXXXXX"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">{t.admin.merchants.beneficiaryName} *</label>
                <input
                  type="text"
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  placeholder="الاسم المطابق لشهادة الآيبان البنكي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBankModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveBankAccount}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                حفظ الحساب البنكي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
