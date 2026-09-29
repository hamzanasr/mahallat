"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../context/LanguageContext";
import {
  Tags,
  Plus,
  Shield,
  FileCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sliders,
  Utensils,
  Coffee,
  ShoppingBag,
  Pill,
} from "lucide-react";

interface CategoryItem {
  id: string;
  name_ar: string;
  name_en: string;
  section_key: string;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
}

interface SfdaReasonItem {
  id: string;
  code: string;
  reason_ar: string;
  reason_en: string;
}

interface DocTypeItem {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  applies_to: "merchant" | "branch";
  is_mandatory: boolean;
  requires_expiry_date: boolean;
}

export default function AdminCategoriesPage() {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<"categories" | "sfda" | "documents">("categories");
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // التصنيفات
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [catNameAr, setCatNameAr] = useState("");
  const [catNameEn, setCatNameEn] = useState("");
  const [catSectionKey, setCatSectionKey] = useState("restaurants");

  // أسباب إعفاء SFDA
  const [sfdaReasons, setSfdaReasons] = useState<SfdaReasonItem[]>([]);

  // أنواع المستندات
  const [docTypes, setDocTypes] = useState<DocTypeItem[]>([]);
  const [showAddDocTypeModal, setShowAddDocTypeModal] = useState(false);
  const [docCode, setDocCode] = useState("");
  const [docNameAr, setDocNameAr] = useState("");
  const [docNameEn, setDocNameEn] = useState("");
  const [docAppliesTo, setDocAppliesTo] = useState<"merchant" | "branch">("branch");
  const [docIsMandatory, setDocIsMandatory] = useState(true);
  const [docRequiresExpiry, setDocRequiresExpiry] = useState(true);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [catsRes, sfdaRes, docsRes] = await Promise.all([
        supabase.from("store_categories").select("*").order("sort_order"),
        supabase.from("sfda_exemption_reasons").select("*").order("code"),
        supabase.from("document_types").select("*").order("created_at"),
      ]);

      setCategories((catsRes.data as unknown as CategoryItem[]) || []);
      setSfdaReasons((sfdaRes.data as unknown as SfdaReasonItem[]) || []);
      setDocTypes((docsRes.data as unknown as DocTypeItem[]) || []);
    } catch (e: any) {
      console.error(e);
      setFeedbackMsg({ type: "error", text: e.message || "تعذر تحميل البيانات" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateCategory = async () => {
    if (!catNameAr.trim()) return;

    try {
      setFeedbackMsg(null);
      const { error } = await supabase.from("store_categories").insert({
        name_ar: catNameAr.trim(),
        name_en: catNameEn.trim() || catNameAr.trim(),
        section_key: catSectionKey,
        sort_order: categories.length + 1,
        is_active: true,
      });

      if (error) throw error;

      setShowAddCatModal(false);
      setCatNameAr("");
      setCatNameEn("");
      setFeedbackMsg({ type: "success", text: "تمت إضافة التصنيف بنجاح" });
      await loadAll();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "تعذر إضافة التصنيف" });
    }
  };

  const handleCreateDocType = async () => {
    if (!docCode.trim() || !docNameAr.trim()) return;

    try {
      setFeedbackMsg(null);
      const { error } = await supabase.from("document_types").insert({
        code: docCode.trim().toLowerCase(),
        name_ar: docNameAr.trim(),
        name_en: docNameEn.trim() || docNameAr.trim(),
        applies_to: docAppliesTo,
        is_mandatory: docIsMandatory,
        requires_expiry_date: docRequiresExpiry,
      });

      if (error) throw error;

      setShowAddDocTypeModal(false);
      setDocCode("");
      setDocNameAr("");
      setDocNameEn("");
      setFeedbackMsg({ type: "success", text: "تمت إضافة نوع المستند بنجاح" });
      await loadAll();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "تعذر إضافة نوع المستند" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Tags className="w-6 h-6 text-blue-500" />
            التصنيفات وقوائم النظام
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة تصنيفات الأقسام، وأسباب إعفاء السعرات (SFDA)، والمستندات الإلزامية (MER-001, MER-009, MER-025)
          </p>
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

      {/* تبويبات الصفحة */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 max-w-xl">
        <button
          onClick={() => setActiveTab("categories")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "categories"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          تصنيفات المتاجر ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab("sfda")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "sfda"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          إعفاءات SFDA ({sfdaReasons.length})
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "documents"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          المستندات الإلزامية ({docTypes.length})
        </button>
      </div>

      {/* 1. تصنيفات المتاجر */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">تصنيفات المتاجر (تحدد موضع الظهور فقط دون المساس بالعقد MER-009)</h2>
            <button
              onClick={() => setShowAddCatModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              إضافة تصنيف جديد
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((c) => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white text-xs">{c.name_ar}</div>
                  <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    {c.section_key}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{c.name_en}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. أسباب إعفاء الغذاء والدواء */}
      {activeTab === "sfda" && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white">
            قائمة أسباب الإعفاء النظامي المعتمدة من هيئة الغذاء والدواء (SFDA) للمنيو (MER-025, REG-002)
          </h2>

          <div className="space-y-2.5">
            {sfdaReasons.map((r) => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-xl border border-blue-500/20 shrink-0">
                  {r.code}
                </span>
                <div>
                  <div className="text-xs font-semibold text-white">{r.reason_ar}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{r.reason_en}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. المستندات الإلزامية */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">أنواع المستندات الرسمية الإلزامية للمنشأة والفروع (MER-001)</h2>
            <button
              onClick={() => setShowAddDocTypeModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              إضافة نوع مستند
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {docTypes.map((dt) => (
              <div key={dt.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white text-xs">{dt.name_ar}</div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      dt.applies_to === "branch"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    }`}
                  >
                    {dt.applies_to === "branch" ? "يخص الفرع" : "يخص المنشأة"}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400">{dt.name_en}</div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 text-[10px]">
                  <span
                    className={
                      dt.is_mandatory ? "text-amber-400 font-semibold" : "text-slate-400"
                    }
                  >
                    {dt.is_mandatory ? "• مستند إلزامي للتفعيل (MER-001)" : "• مستند اختياري"}
                  </span>
                  <span>·</span>
                  <span className="text-slate-400">
                    {dt.requires_expiry_date ? "يشترط تاريخ انتهاء" : "بدون تاريخ انتهاء"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* مودال إضافة تصنيف */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              إضافة تصنيف جديد
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">اسم التصنيف (عربي) *</label>
                <input
                  type="text"
                  value={catNameAr}
                  onChange={(e) => setCatNameAr(e.target.value)}
                  placeholder="مثال: شاورما وفطائر"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">اسم التصنيف (إنجليزي)</label>
                <input
                  type="text"
                  value={catNameEn}
                  onChange={(e) => setCatNameEn(e.target.value)}
                  placeholder="Example: Shawarma & Pies"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">قسم التشغيل التابع له</label>
                <select
                  value={catSectionKey}
                  onChange={(e) => setCatSectionKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="restaurants">مطاعم</option>
                  <option value="cafes">كافيهات</option>
                  <option value="retail">محلات متنوعة</option>
                  <option value="mart">مارت</option>
                  <option value="pharmacy">صيدليات</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddCatModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                حفظ التصنيف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال إضافة نوع مستند */}
      {showAddDocTypeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              إضافة نوع مستند رسمي
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">رمز المستند (Code) *</label>
                <input
                  type="text"
                  value={docCode}
                  onChange={(e) => setDocCode(e.target.value)}
                  placeholder="مثال: fire_permit"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">اسم المستند (عربي) *</label>
                <input
                  type="text"
                  value={docNameAr}
                  onChange={(e) => setDocNameAr(e.target.value)}
                  placeholder="تصريح السلامة من الحريق"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">ينطبق على</label>
                <select
                  value={docAppliesTo}
                  onChange={(e) => setDocAppliesTo(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="branch">الفرع (Branch)</option>
                  <option value="merchant">المنشأة كاملة (Merchant)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="mandatoryCheck"
                  checked={docIsMandatory}
                  onChange={(e) => setDocIsMandatory(e.target.checked)}
                  className="accent-blue-600 rounded"
                />
                <label htmlFor="mandatoryCheck" className="text-slate-300">
                  مستند إلزامي (يمنع تفعيل الفرع بدونه)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddDocTypeModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateDocType}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                حفظ نوع المستند
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
