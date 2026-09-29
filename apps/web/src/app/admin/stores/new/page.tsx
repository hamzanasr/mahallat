"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { useLanguage } from "../../../../context/LanguageContext";
import {
  Store,
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  MapPin,
  Clock,
  Shield,
  FileText,
  DollarSign,
  AlertCircle,
  Plus,
} from "lucide-react";

interface MerchantOption {
  id: string;
  commercial_name: string;
}

interface CityOption {
  id: string;
  name_ar: string;
  name_en: string;
}

interface CategoryOption {
  id: string;
  name_ar: string;
  section_key: string;
}

export default function NewStorePage() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // قوائم الاختيارات
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // 1. البيانات الأساسية ونوع المتجر
  const [merchantId, setMerchantId] = useState("");
  const [newMerchantName, setNewMerchantName] = useState("");
  const [isCreatingNewMerchant, setIsCreatingNewMerchant] = useState(false);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [storeType, setStoreType] = useState<"contracted_menu" | "contracted_text_only">("contracted_menu");
  const [operationType, setOperationType] = useState<"restaurant" | "retail" | "mart" | "pharmacy">("restaurant");
  const [categoryId, setCategoryId] = useState("");

  // 2. المدينة والنطاق
  const [cityId, setCityId] = useState("");
  const [deliveryScope, setDeliveryScope] = useState<"whole_city" | "custom_zone">("whole_city");

  // 3. الإعدادات التشغيلية
  const [minOrderSar, setMinOrderSar] = useState("0");
  const [defaultPrepTime, setDefaultPrepTime] = useState("20");
  const [canExceedMaxPrepTime, setCanExceedMaxPrepTime] = useState(false);
  const [menuPermission, setMenuPermission] = useState<"full" | "price_tolerance" | "review_required">("review_required");
  const [tolerancePercentage, setTolerancePercentage] = useState("5.0");
  const [selfPickupEnabled, setSelfPickupEnabled] = useState(false);
  const [selfPickupDiscount, setSelfPickupDiscount] = useState("10.0");
  const [selfPickupBearer, setSelfPickupBearer] = useState<"platform" | "merchant" | "split">("merchant");

  // 4. العقد المالي
  const [pricingModel, setPricingModel] = useState<"per_customer" | "percentage" | "no_commission">("percentage");
  const [contractPercentage, setContractPercentage] = useState("10.0");
  const [tier1FeeSar, setTier1FeeSar] = useState("2.00");
  const [tier1ThresholdSar, setTier1ThresholdSar] = useState("25.00");
  const [tier2FeeSar, setTier2FeeSar] = useState("5.00");
  const [perCustomerCapSar, setPerCustomerCapSar] = useState("30.00");
  const [pgFeePct, setPgFeePct] = useState("2.50");
  const [pgFeeFixedSar, setPgFeeFixedSar] = useState("1.00");
  const [menuMarkupPct, setMenuMarkupPct] = useState("0.0");

  // 5. الكاشير والرابط والتراخيص
  const [posSystemName, setPosSystemName] = useState("Foodics");
  const [customPosName, setCustomPosName] = useState("");
  const [menuSlug, setMenuSlug] = useState("");
  const [pharmacyLicenseNumber, setPharmacyLicenseNumber] = useState("");
  const [pharmacyLicenseExpiry, setPharmacyLicenseExpiry] = useState("");

  const loadOptions = async () => {
    try {
      const [merchantsRes, citiesRes, catsRes] = await Promise.all([
        supabase.from("merchants").select("id, commercial_name").order("commercial_name"),
        supabase.from("cities").select("id, name_ar, name_en").eq("is_active", true).order("name_ar"),
        supabase.from("store_categories").select("id, name_ar, section_key").eq("is_active", true).order("sort_order"),
      ]);

      if (merchantsRes.data) {
        setMerchants(merchantsRes.data);
        if (merchantsRes.data.length > 0) setMerchantId(merchantsRes.data[0].id);
      }
      if (citiesRes.data) {
        setCities(citiesRes.data);
        if (citiesRes.data.length > 0) setCityId(citiesRes.data[0].id);
      }
      if (catsRes.data) {
        setCategories(catsRes.data);
        if (catsRes.data.length > 0) setCategoryId(catsRes.data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const handleNameChange = (val: string) => {
    setNameAr(val);
    if (!menuSlug || menuSlug === "store-") {
      const slugCandidate = val
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-");
      setMenuSlug(slugCandidate ? `store-${slugCandidate}` : `store-${Date.now().toString().slice(-5)}`);
    }
  };

  const validateStep = (step: number) => {
    setErrorMsg("");
    if (step === 1) {
      if (isCreatingNewMerchant && !newMerchantName.trim()) {
        setErrorMsg("اسم المنشأة التجاري مطلوب");
        return false;
      }
      if (!isCreatingNewMerchant && !merchantId) {
        setErrorMsg("يرجى اختيار المنشأة (التاجر)");
        return false;
      }
      if (!nameAr.trim()) {
        setErrorMsg("اسم المتجر بالعربية مطلوب");
        return false;
      }
      if (!nameEn.trim()) {
        setErrorMsg("اسم المتجر بالإنجليزية مطلوب");
        return false;
      }
    }
    if (step === 2) {
      if (!cityId) {
        setErrorMsg("يرجى تحديد المدينة");
        return false;
      }
    }
    if (step === 3) {
      const prep = parseInt(defaultPrepTime, 10);
      if (isNaN(prep) || prep <= 0) {
        setErrorMsg("مدة التحضير يجب أن تكون رقماً أكبر من صفر");
        return false;
      }
      if (prep > 40 && !canExceedMaxPrepTime) {
        setErrorMsg("مدة التحضير لا تتجاوز 40 دقيقة إلا بتفعيل صلاحية التجاوز (MER-040)");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setErrorMsg("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setSubmitting(true);
      setErrorMsg("");

      // 1. إنشاء المنشأة إذا كانت جديدة
      let finalMerchantId = merchantId;
      if (isCreatingNewMerchant) {
        const { data: createdMerchant, error: merchantErr } = await supabase
          .from("merchants")
          .insert({ commercial_name: newMerchantName.trim() })
          .select("id")
          .single();

        if (merchantErr || !createdMerchant) {
          throw new Error(merchantErr?.message || "فشل إنشاء المنشأة الجديدة");
        }
        finalMerchantId = createdMerchant.id;
      }

      // 2. التحقق من الرابط الفريد (Menu Slug)
      const cleanSlug = (menuSlug || `store-${Date.now().toString().slice(-6)}`)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-");

      // 3. إنشاء المتجر
      const { data: newStore, error: storeErr } = await supabase
        .from("stores")
        .insert({
          merchant_id: finalMerchantId,
          name_ar: nameAr.trim(),
          name_en: nameEn.trim(),
          store_type: storeType,
          operation_type: operationType,
          category_id: categoryId || null,
          city_id: cityId,
          min_order_halalas: Math.round(parseFloat(minOrderSar || "0") * 100),
          default_prep_time_minutes: parseInt(defaultPrepTime, 10) || 20,
          can_exceed_max_prep_time: canExceedMaxPrepTime,
          menu_permission: menuPermission,
          menu_price_tolerance_percentage: parseFloat(tolerancePercentage) || 0,
          self_pickup_enabled: selfPickupEnabled,
          self_pickup_discount_percentage: selfPickupEnabled ? parseFloat(selfPickupDiscount) || 0 : 0,
          self_pickup_cost_bearer: selfPickupBearer,
          pos_system_name: posSystemName === "other" ? customPosName : posSystemName,
          menu_slug: cleanSlug,
          pharmacy_license_number: operationType === "pharmacy" ? pharmacyLicenseNumber : null,
          pharmacy_license_expiry: operationType === "pharmacy" && pharmacyLicenseExpiry ? pharmacyLicenseExpiry : null,
        })
        .select("id")
        .single();

      if (storeErr || !newStore) {
        throw new Error(storeErr?.message || "فشل إنشاء المتجر");
      }

      // 4. إنشاء العقد المالي المخصص
      const { error: contractErr } = await supabase.rpc("admin_create_store_contract", {
        p_store_id: newStore.id,
        p_pricing_model: pricingModel,
        p_tier1_fee_halalas: Math.round(parseFloat(tier1FeeSar) * 100),
        p_tier1_order_threshold_halalas: Math.round(parseFloat(tier1ThresholdSar) * 100),
        p_tier2_fee_halalas: Math.round(parseFloat(tier2FeeSar) * 100),
        p_contract_per_customer_cap_halalas: Math.round(parseFloat(perCustomerCapSar) * 100),
        p_contract_per_customer_period_days: 365,
        p_contract_percentage: parseFloat(contractPercentage) || 10.0,
        p_menu_markup_percentage: parseFloat(menuMarkupPct) || 0.0,
        p_menu_markup_platform_share_percentage: 100.0,
        p_payment_gateway_fee_percentage: parseFloat(pgFeePct) || 2.5,
        p_payment_gateway_fee_fixed_halalas: Math.round(parseFloat(pgFeeFixedSar) * 100),
        p_mart_pharmacy_merchant_percentage: 5.0,
        p_mart_pharmacy_customer_markup_percentage: 5.0,
        p_text_orders_platform_fee_percentage: 5.0,
      });

      if (contractErr) {
        console.warn("Contract creation notice:", contractErr);
      }

      // التوجيه لملف المتجر لإضافة الفروع والمنيو
      router.push(`/admin/stores/${newStore.id}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء حفظ المتجر");
    } finally {
      setSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, title: "النوع والمنشأة", icon: Store },
    { num: 2, title: "المدينة والنطاق", icon: MapPin },
    { num: 3, title: "الإعدادات التشغيلية", icon: Clock },
    { num: 4, title: "العقد المالي", icon: DollarSign },
    { num: 5, title: "الكاشير والرابط", icon: FileText },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/stores"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-500" />
              {t.admin.stores.addStore}
            </h1>
            <p className="text-xs text-slate-400">نموذج مراحل إضافة متجر جديد وفق مواصفات المنصة (09-stores.md)</p>
          </div>
        </div>
      </div>

      {/* مؤشر الخطوات */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 -translate-y-1/2 start-6 end-6 h-0.5 bg-slate-800 -z-0" />
          {stepsList.map((step) => {
            const isDone = currentStep > step.num;
            const isCurrent = currentStep === step.num;
            const Icon = step.icon;

            return (
              <div key={step.num} className="relative z-10 flex flex-col items-center gap-1.5 bg-slate-900 px-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                    isDone
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : isCurrent
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30"
                      : "bg-slate-800 text-slate-500 border border-slate-700/50"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`text-[10px] font-medium hidden sm:block ${
                    isCurrent ? "text-blue-400 font-semibold" : isDone ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* محتوى المرحلة الحالية */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        {/* المرحلة 1: نوع المتجر والمنشأة والتصنيف */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-white pb-3 border-b border-slate-800">
              المرحلة 1: نوع المتجر ونوع التشغيل والتصنيف
            </h2>

            {/* المنشأة (التاجر) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">المنشأة التجارية (التاجر)</label>
              {!isCreatingNewMerchant ? (
                <div className="flex gap-2">
                  <select
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {merchants.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.commercial_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewMerchant(true)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    منشأة جديدة
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMerchantName}
                    onChange={(e) => setNewMerchantName(e.target.value)}
                    placeholder="اسم المنشأة التجاري الجديد (مثلاً: شركة أطايب الشرق)"
                    className="flex-1 bg-slate-950 border border-blue-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewMerchant(false)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs shrink-0"
                  >
                    اختيار موجودة
                  </button>
                </div>
              )}
            </div>

            {/* اسم المتجر */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">اسم المتجر بالعربي *</label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="مثال: برجر الحي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">اسم المتجر بالإنجليزي *</label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Example: Burger Al-Hay"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* نوع المتجر */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">نوع المتجر (MER-046)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                    storeType === "contracted_menu"
                      ? "bg-blue-600/10 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>متعاقد بمنيو</span>
                    <input
                      type="radio"
                      name="storeType"
                      checked={storeType === "contracted_menu"}
                      onChange={() => setStoreType("contracted_menu")}
                      className="accent-blue-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 leading-relaxed">
                    طلب توصيل عادي، ويتاح له محرر منيو وكتالوج.
                  </span>
                </label>

                <label
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                    storeType === "contracted_text_only"
                      ? "bg-blue-600/10 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>متعاقد كتابة فقط</span>
                    <input
                      type="radio"
                      name="storeType"
                      checked={storeType === "contracted_text_only"}
                      onChange={() => setStoreType("contracted_text_only")}
                      className="accent-blue-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 leading-relaxed">
                    طلبات كتابة وفواتير متجر دون منيو رقمي.
                  </span>
                </label>
              </div>
            </div>

            {/* نوع التشغيل والقسم (MER-009) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">نوع التشغيل (نموذج الرسوم)</label>
                <select
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="restaurant">مطاعم</option>
                  <option value="retail">محلات متنوعة</option>
                  <option value="mart">مارت</option>
                  <option value="pharmacy">صيدليات</option>
                </select>
                <p className="text-[10px] text-slate-500">نوع التشغيل هو الذي يحدد هيكل العقد المالي (MER-009)</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">التصنيف الظاهر للعميل</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_ar}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">تغيير التصنيف يحدد مكان الظهور فقط ولا يغيّر الرسوم</p>
              </div>
            </div>
          </div>
        )}

        {/* المرحلة 2: المدينة ونطاق التوصيل */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-white pb-3 border-b border-slate-800">
              المرحلة 2: المدينة ونطاق التوصيل الجغرافي
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">المدينة المعتمدة *</label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name_ar} ({city.name_en})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">نطاق التوصيل</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                    deliveryScope === "whole_city"
                      ? "bg-blue-600/10 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>المحافظة كاملة (الافتراضي)</span>
                    <input
                      type="radio"
                      name="deliveryScope"
                      checked={deliveryScope === "whole_city"}
                      onChange={() => setDeliveryScope("whole_city")}
                      className="accent-blue-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 leading-relaxed">
                    يخدم كامل المضلع الجغرافي للمدينة وفق PostGIS (DSP-002).
                  </span>
                </label>

                <label
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                    deliveryScope === "custom_zone"
                      ? "bg-blue-600/10 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>زون محدد داخل المدينة</span>
                    <input
                      type="radio"
                      name="deliveryScope"
                      checked={deliveryScope === "custom_zone"}
                      onChange={() => setDeliveryScope("custom_zone")}
                      className="accent-blue-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 leading-relaxed">
                    تخصيص نطاق فرعي محدد لهذا المتجر (MER-046).
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* المرحلة 3: الإعدادات التشغيلية */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-white pb-3 border-b border-slate-800">
              المرحلة 3: الإعدادات التشغيلية والمنيو
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">الحد الأدنى للطلب (ر.س)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={minOrderSar}
                  onChange={(e) => setMinOrderSar(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">مدة التحضير الافتراضية (دقيقة)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={defaultPrepTime}
                  onChange={(e) => setDefaultPrepTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* صلاحية تجاوز 40 دقيقة (MER-040) */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">منح صلاحية تجاوز 40 دقيقة (MER-040)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  الافتراضي هو حظر أي تحضير فوق 40 دقيقة لحماية تجربة العميل
                </div>
              </div>
              <input
                type="checkbox"
                checked={canExceedMaxPrepTime}
                onChange={(e) => setCanExceedMaxPrepTime(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </div>

            {/* صلاحيات التاجر على المنيو (MER-002) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">صلاحيات التاجر على المنيو والأسعار (MER-002)</label>
              <div className="space-y-2">
                <label
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                    menuPermission === "review_required"
                      ? "bg-blue-600/10 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <span className="font-semibold block">كل تعديل يمر بالمراجعة (الافتراضي)</span>
                    <span className="text-[10px] text-slate-400">
                      أي تعديل من التاجر يحال إلى صفحة «مراجعة التجار» بالسعر قبل وبعد.
                    </span>
                  </div>
                  <input
                    type="radio"
                    name="menuPermission"
                    checked={menuPermission === "review_required"}
                    onChange={() => setMenuPermission("review_required")}
                    className="accent-blue-500"
                  />
                </label>

                <label
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                    menuPermission === "price_tolerance"
                      ? "bg-blue-600/10 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex-1 pe-4">
                    <span className="font-semibold block">تعديل الأسعار بلا اعتماد في حدود نسبة</span>
                    <span className="text-[10px] text-slate-400">
                      التعديل ضمن النسبة يُطبق فوراً، وما يتجاوزها يمر بالمراجعة.
                    </span>
                    {menuPermission === "price_tolerance" && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-slate-300">نسبة السماح:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="50"
                          value={tolerancePercentage}
                          onChange={(e) => setTolerancePercentage(e.target.value)}
                          className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                        />
                        <span className="text-[11px] text-slate-400">%</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="radio"
                    name="menuPermission"
                    checked={menuPermission === "price_tolerance"}
                    onChange={() => setMenuPermission("price_tolerance")}
                    className="accent-blue-500"
                  />
                </label>

                <label
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                    menuPermission === "full"
                      ? "bg-blue-600/10 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <span className="font-semibold block">صلاحية كاملة</span>
                    <span className="text-[10px] text-slate-400">
                      التاجر يضيف ويعدل المنتجات والأسعار بلا أي اعتماد مسبق.
                    </span>
                  </div>
                  <input
                    type="radio"
                    name="menuPermission"
                    checked={menuPermission === "full"}
                    onChange={() => setMenuPermission("full")}
                    className="accent-blue-500"
                  />
                </label>
              </div>
            </div>

            {/* الاستلام الذاتي */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">قبول الاستلام الذاتي من الفرع</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">يتيح للعميل الطلب والاستلام بنفسه</div>
                </div>
                <input
                  type="checkbox"
                  checked={selfPickupEnabled}
                  onChange={(e) => setSelfPickupEnabled(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </div>

              {selfPickupEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-850">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">نسبة خصم الاستلام الذاتي للعميل (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="50"
                      value={selfPickupDiscount}
                      onChange={(e) => setSelfPickupDiscount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">من يتحمل الخصم</label>
                    <select
                      value={selfPickupBearer}
                      onChange={(e) => setSelfPickupBearer(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    >
                      <option value="merchant">التاجر كاملاً</option>
                      <option value="platform">المنصة كاملة</option>
                      <option value="split">مناصفة (50/50)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* المرحلة 4: عقد الرسوم المالي */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-white pb-3 border-b border-slate-800">
              المرحلة 4: عقد الرسوم المالي (12-fees.md)
            </h2>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">نموذج العقد المالي (ما يُخصم من التاجر)</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                    pricingModel === "percentage"
                      ? "bg-blue-600/10 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>نسبة مئوية</span>
                    <input
                      type="radio"
                      name="pricingModel"
                      checked={pricingModel === "percentage"}
                      onChange={() => setPricingModel("percentage")}
                      className="accent-blue-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">نسبة ثابتة من قيمة المنتجات (افتراضياً 10%)</span>
                </label>

                <label
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                    pricingModel === "per_customer"
                      ? "bg-blue-600/10 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>رسوم لكل عميل</span>
                    <input
                      type="radio"
                      name="pricingModel"
                      checked={pricingModel === "per_customer"}
                      onChange={() => setPricingModel("per_customer")}
                      className="accent-blue-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">شرائح حسب قيمة الطلب مع سقف سنوي</span>
                </label>

                <label
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                    pricingModel === "no_commission"
                      ? "bg-blue-600/10 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>بدون خصم</span>
                    <input
                      type="radio"
                      name="pricingModel"
                      checked={pricingModel === "no_commission"}
                      onChange={() => setPricingModel("no_commission")}
                      className="accent-blue-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">لا خصم على التاجر عدا رسم بوابة الدفع</span>
                </label>
              </div>
            </div>

            {/* تفاصيل العقد حسب النموذج */}
            {pricingModel === "percentage" && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <label className="text-xs font-medium text-slate-300">نسبة المنصة المقتطعة من التاجر (%)</label>
                <div className="flex items-center gap-2 max-w-xs">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={contractPercentage}
                    onChange={(e) => setContractPercentage(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              </div>
            )}

            {pricingModel === "per_customer" && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">رسم طلب أقل من الحد (ر.س)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tier1FeeSar}
                    onChange={(e) => setTier1FeeSar(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">حد الشريحة الأولى (ر.س)</label>
                  <input
                    type="number"
                    step="1"
                    value={tier1ThresholdSar}
                    onChange={(e) => setTier1ThresholdSar(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">رسم طلب من الحد فأكثر (ر.س)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tier2FeeSar}
                    onChange={(e) => setTier2FeeSar(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">السقف السنوي لكل عميل (ر.س)</label>
                  <input
                    type="number"
                    step="5"
                    value={perCustomerCapSar}
                    onChange={(e) => setPerCustomerCapSar(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* رسم الدفع الإلكتروني والزيادة */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">رسم بوابة الدفع الإلكتروني (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pgFeePct}
                  onChange={(e) => setPgFeePct(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">رسم بوابة الدفع الثابت (ر.س)</label>
                <input
                  type="number"
                  step="0.25"
                  value={pgFeeFixedSar}
                  onChange={(e) => setPgFeeFixedSar(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* المرحلة 5: الكاشير والرابط والتراخيص */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-white pb-3 border-b border-slate-800">
              المرحلة 5: ربط الكاشير ورابط المنيو المجاني
            </h2>

            {/* الكاشير */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">نظام الكاشير (MER-011)</label>
              <select
                value={posSystemName}
                onChange={(e) => setPosSystemName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Foodics">فودكس (Foodics)</option>
                <option value="Marn">مرن (Marn)</option>
                <option value="Rewaa">رواء (Rewaa)</option>
                <option value="Qoyod">قيود (Qoyod)</option>
                <option value="Snad">سند (Snad)</option>
                <option value="Geidea">جيديا (Geidea)</option>
                <option value="other">برنامج آخر...</option>
              </select>

              {posSystemName === "other" && (
                <input
                  type="text"
                  value={customPosName}
                  onChange={(e) => setCustomPosName(e.target.value)}
                  placeholder="اكتب اسم نظام الكاشير المستخدم"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 mt-2 focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            {/* رابط المنيو المجاني (MER-007) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">امتداد رابط المنيو المجاني (Slug)</label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono">
                <span className="text-slate-500 select-none">mahallat.online/</span>
                <input
                  type="text"
                  value={menuSlug}
                  onChange={(e) => setMenuSlug(e.target.value)}
                  placeholder="store-name"
                  className="bg-transparent border-none focus:outline-none text-blue-400 flex-1 px-1"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                الطلبات التي تأتي من هذا الرابط لا تُخصم عليها نسبة العقد للتاجر (MER-007)
              </p>
            </div>

            {/* للصيدليات فقط */}
            {operationType === "pharmacy" && (
              <div className="p-4 bg-slate-950 border border-blue-500/30 rounded-xl space-y-3">
                <div className="text-xs font-bold text-white">تراخيص الصيدلية (نظامي)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">رقم ترخيص الصيدلية</label>
                    <input
                      type="text"
                      value={pharmacyLicenseNumber}
                      onChange={(e) => setPharmacyLicenseNumber(e.target.value)}
                      placeholder="رقم الترخيص من وزارة الصحة"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">تاريخ انتهاء الترخيص</label>
                    <input
                      type="date"
                      value={pharmacyLicenseExpiry}
                      onChange={(e) => setPharmacyLicenseExpiry(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* أزرار التنقل */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800 mt-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              السابق
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all"
            >
              التالي
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  جاري الحفظ والإنشاء...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  حفظ ونشر المتجر
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
