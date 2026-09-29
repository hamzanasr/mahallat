"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import {
  Sliders,
  Search,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Clock,
  Coins,
  ShieldCheck,
  Truck,
  Gift,
  Lock,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react";

interface SettingItem {
  key: string;
  name_ar: string;
  description_ar: string | null;
  category: string;
  type: string;
  default_value: any;
  min_value: number | null;
  max_value: number | null;
  current_value: any;
  overrides_count: number;
}

export default function AdminSettingsPage() {
  const { isSupport } = useAdminAuth();
  const { t, isRTL } = useLanguage();

  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("financial");

  // نافذة التعديل
  const [selectedSetting, setSelectedSetting] = useState<SettingItem | null>(null);
  const [newValueInput, setNewValueInput] = useState<string>("");
  const [reasonInput, setReasonInput] = useState<string>("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // التبويبات المتاحة
  const TABS = [
    { id: "financial", name: t.admin.settingsTabs.financial, icon: Coins, restrictedForSupport: true },
    { id: "timeouts", name: t.admin.settingsTabs.timeouts, icon: Clock, restrictedForSupport: false },
    { id: "dispatch", name: t.admin.settingsTabs.dispatch, icon: Truck, restrictedForSupport: false },
    { id: "drivers", name: t.admin.settingsTabs.drivers, icon: Truck, restrictedForSupport: false },
    { id: "loyalty", name: t.admin.settingsTabs.loyalty, icon: Gift, restrictedForSupport: false },
    { id: "security", name: t.admin.settingsTabs.permissions, icon: Lock, restrictedForSupport: false },
  ];

  // جلب الإعدادات من Supabase
  const loadSettings = async () => {
    setLoading(true);
    try {
      // 1. جلب التعريفات
      const { data: defs, error: defsError } = await supabase
        .from("setting_definitions")
        .select("*")
        .order("key");

      if (defsError) throw defsError;

      // 2. جلب القيم المسجلة
      const { data: vals, error: valsError } = await supabase
        .from("setting_values")
        .select("*");

      if (valsError) throw valsError;

      // دمج البيانات وحساب التخصيصات للمدن والمتاجر
      const getCategoryFromKey = (key: string) => {
        if (key.includes("fee") || key.includes("vat") || key.includes("commission") || key.includes("halalas") || key.includes("price")) return "financial";
        if (key.includes("timeout") || key.includes("grace") || key.includes("buffer") || key.includes("minutes") || key.includes("seconds")) return "timeouts";
        if (key.includes("dispatch") || key.includes("radius") || key.includes("cluster") || key.includes("batch")) return "dispatch";
        if (key.includes("driver") || key.includes("fine") || key.includes("penalty")) return "drivers";
        if (key.includes("loyalty") || key.includes("reward") || key.includes("point")) return "loyalty";
        return "security";
      };

      const merged: SettingItem[] = (defs || []).map((def) => {
        const globalVal = vals?.find((v) => v.key === def.key && v.level === "global");
        const overrides = vals?.filter((v) => v.key === def.key && v.level !== "global") || [];

        const currentValue =
          globalVal?.value !== undefined
            ? typeof globalVal.value === "object" && globalVal.value !== null && "value" in (globalVal.value as any)
              ? (globalVal.value as any).value
              : globalVal.value
            : typeof def.default_value === "object" && def.default_value !== null && "value" in (def.default_value as any)
            ? (def.default_value as any).value
            : def.default_value;

        return {
          key: def.key,
          name_ar: def.name_ar,
          description_ar: def.description_ar,
          category: getCategoryFromKey(def.key),
          type: def.type,
          default_value:
            typeof def.default_value === "object" && def.default_value !== null && "value" in (def.default_value as any)
              ? (def.default_value as any).value
              : def.default_value,
          min_value: def.min_value,
          max_value: def.max_value,
          current_value: currentValue,
          overrides_count: overrides.length,
        };
      });

      setSettings(merged);
    } catch (err: any) {
      console.error("خطأ في جلب الإعدادات:", err);
      setStatusMessage({ type: "error", text: err.message || "فشل تحميل الإعدادات" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // إذا كان دور المستخدم دعم فقط، ننتقل تلقائياً لتبويب غير مالي
    if (isSupport && activeTab === "financial") {
      setActiveTab("timeouts");
    }
    loadSettings();
  }, [isSupport]);

  // فتح نافذة تعديل إعداد
  const handleOpenEdit = (setting: SettingItem) => {
    setSelectedSetting(setting);
    setNewValueInput(String(setting.current_value ?? ""));
    setReasonInput("");
    setShowConfirmModal(false);
  };

  // المتابعة لنافذة تأكيد التعديل
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonInput.trim()) {
      setStatusMessage({ type: "error", text: t.admin.settingsFields.reasonRequired });
      return;
    }
    setShowConfirmModal(true);
  };

  // حفظ التعديل عبر دالة admin_update_setting RPC
  const handleSaveSetting = async () => {
    if (!selectedSetting) return;

    setSaving(true);
    setStatusMessage(null);

    try {
      // تجهيز القيمة وفق النوع
      let parsedValue: any = newValueInput;
      if (
        selectedSetting.type === "number" ||
        selectedSetting.type === "percentage" ||
        selectedSetting.type === "amount_halalas" ||
        selectedSetting.type === "duration_minutes" ||
        selectedSetting.type === "duration_seconds"
      ) {
        parsedValue = Number(newValueInput);
      } else if (selectedSetting.type === "boolean") {
        parsedValue = newValueInput === "true";
      }

      const { data, error } = await supabase.rpc("admin_update_setting", {
        p_key: selectedSetting.key,
        p_value: parsedValue as any,
        p_reason: reasonInput.trim(),
        p_city_id: undefined,
        p_store_id: undefined,
      });

      if (error) throw error;

      setStatusMessage({ type: "success", text: `تم بنجاح تعديل إعداد (${selectedSetting.name_ar}) وتسجيله في سجل التدقيق` });
      setSelectedSetting(null);
      setShowConfirmModal(false);
      await loadSettings();
    } catch (err: any) {
      console.error("فشل حفظ الإعداد:", err);
      setStatusMessage({ type: "error", text: err.message || "حدث خطأ أثناء حفظ الإعداد" });
    } finally {
      setSaving(false);
    }
  };

  // تصفية الإعدادات حسب التبويب والبحث
  const filteredSettings = settings.filter((item) => {
    const matchesCategory =
      activeTab === "financial"
        ? item.category === "financial" || item.key.includes("fee") || item.key.includes("vat") || item.key.includes("commission")
        : activeTab === "timeouts"
        ? item.category === "timeouts" || item.key.includes("timeout") || item.key.includes("buffer")
        : activeTab === "dispatch"
        ? item.category === "dispatch" || item.key.includes("radius") || item.key.includes("dispatch") || item.key.includes("order")
        : activeTab === "drivers"
        ? item.category === "drivers" || item.key.includes("driver") || item.key.includes("penalty")
        : activeTab === "loyalty"
        ? item.category === "loyalty" || item.key.includes("loyalty") || item.key.includes("points")
        : item.category === "security" || item.key.includes("admin") || item.key.includes("auth") || item.key.includes("session");

    const matchesSearch =
      !searchQuery.trim() ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name_ar.includes(searchQuery) ||
      (item.description_ar && item.description_ar.includes(searchQuery));

    return matchesCategory && matchesSearch;
  });

  const formatValue = (val: any, type: string) => {
    if (val === null || val === undefined) return "-";
    if (type === "percentage") return `${val}%`;
    if (type === "amount_halalas") return `${(Number(val) / 100).toFixed(2)} ر.س (${val} هللة)`;
    if (type === "duration_minutes") return `${val} دقيقة`;
    if (type === "duration_seconds") return `${val} ثانية`;
    if (type === "boolean") return val ? "نعم / مفعل" : "لا / معطل";
    return String(val);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* الترويسة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <span>{t.admin.nav.settings}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة كافة المتغيرات المرنة وحساب الرسوم والمهل طبقاً للمتطلب (ADM-034). كل تعديل يتطلب سبباً إلزامياً ويُسجل في التدقيق.
          </p>
        </div>

        {/* حقل البحث */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في الإعدادات..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
        </div>
      </div>

      {/* تنبيه الحالة إن وجد */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-200"
              : "bg-red-950/60 border-red-800/60 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* تنبيه حجب المالية لموظف الدعم */}
      {isSupport && (
        <div className="p-3.5 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-200 flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{t.admin.settingsFields.restrictedNotice}</span>
        </div>
      )}

      {/* شريط التبويبات */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isRestricted = isSupport && tab.restrictedForSupport;

          if (isRestricted) {
            return (
              <button
                key={tab.id}
                disabled
                className="px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 bg-slate-900/40 text-slate-600 border border-slate-800/40 cursor-not-allowed opacity-50"
                title="محجوب عن دور الدعم"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{tab.name}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* جدول / بطاقات الإعدادات */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            <span>جاري تحميل الإعدادات من الخادم...</span>
          </div>
        ) : filteredSettings.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            لا توجد إعدادات مطابقة لبحثك في هذا التبويب.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">{t.admin.settingsFields.name}</th>
                  <th className="py-3 px-4 font-semibold">{t.admin.settingsFields.key}</th>
                  <th className="py-3 px-4 font-semibold">{t.admin.settingsFields.currentValue}</th>
                  <th className="py-3 px-4 font-semibold">{t.admin.settingsFields.defaultValue}</th>
                  <th className="py-3 px-4 font-semibold">{t.admin.settingsFields.overridesCount}</th>
                  <th className="py-3 px-4 font-semibold text-center">{t.common.edit}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSettings.map((item) => (
                  <tr key={item.key} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{item.name_ar}</div>
                      {item.description_ar && (
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {item.description_ar}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-blue-400">
                      {item.key}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-emerald-400">
                      {formatValue(item.current_value, item.type)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {formatValue(item.default_value, item.type)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
                        {item.overrides_count} تخصيص
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        disabled={isSupport}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 text-xs font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t.admin.settingsFields.edit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة تعديل الإعداد (Modal) */}
      {selectedSetting && !showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedSetting.name_ar}</h3>
                <span className="text-xs font-mono text-blue-400">{selectedSetting.key}</span>
              </div>
              <button
                onClick={() => setSelectedSetting(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedSetting.description_ar && (
              <p className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {selectedSetting.description_ar}
              </p>
            )}

            <form onSubmit={handleProceedToConfirm} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    {t.admin.settingsFields.newValue}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    القيمة الحالية: {formatValue(selectedSetting.current_value, selectedSetting.type)}
                  </span>
                </div>

                {selectedSetting.type === "boolean" ? (
                  <select
                    value={newValueInput}
                    onChange={(e) => setNewValueInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="true">نعم / مفعل (True)</option>
                    <option value="false">لا / معطل (False)</option>
                  </select>
                ) : (
                  <input
                    type={
                      selectedSetting.type === "percentage" ||
                      selectedSetting.type === "number" ||
                      selectedSetting.type === "amount_halalas" ||
                      selectedSetting.type === "duration_minutes" ||
                      selectedSetting.type === "duration_seconds"
                        ? "number"
                        : "text"
                    }
                    step={selectedSetting.type === "percentage" ? "0.1" : "1"}
                    required
                    value={newValueInput}
                    onChange={(e) => setNewValueInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                )}

                {(selectedSetting.min_value !== null || selectedSetting.max_value !== null) && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    الحد الأدنى: {selectedSetting.min_value ?? "غير محدد"} · الحد الأعلى: {selectedSetting.max_value ?? "غير محدد"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  <span className="text-red-400">*</span> {t.admin.settingsFields.reason}
                </label>
                <textarea
                  required
                  rows={2}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="مثال: تعديل النسبة استجابة لتعميم هيئة الزكاة، أو تحسين سرعة إسناد الطلبات..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-amber-400 block mt-1">
                  * إلزامي لتوثيقه في سجل التدقيق وفق المتطلب (ADM-034).
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedSetting(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition"
                >
                  مراجعة وتأكيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة التأكيد قبل وبعد (Confirmation Dialog) */}
      {selectedSetting && showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>{t.admin.settingsFields.confirmEdit}</span>
            </h3>
            <p className="text-xs text-slate-400">
              يرجى مراجعة تفاصيل التغيير قبل الاعتماد، حيث سينعكس التغيير فوراً في النظام ويُسجل باسمك في التدقيق:
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">الإعداد:</span>
                <span className="font-semibold text-white">{selectedSetting.name_ar}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">{t.admin.settingsFields.previousValue}:</span>
                <span className="font-mono text-red-400">
                  {formatValue(selectedSetting.current_value, selectedSetting.type)}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">{t.admin.settingsFields.newValue}:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {formatValue(newValueInput, selectedSetting.type)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">{t.admin.settingsFields.reason}:</span>
                <p className="text-slate-200 bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] leading-relaxed">
                  {reasonInput}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                تراجع للتعديل
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveSetting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
              >
                {saving ? "جاري الحفظ..." : t.admin.settingsFields.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
