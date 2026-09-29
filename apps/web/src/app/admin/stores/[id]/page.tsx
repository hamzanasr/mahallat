"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { useLanguage } from "../../../../context/LanguageContext";
import {
  Store,
  ArrowRight,
  MapPin,
  UtensilsCrossed,
  FileText,
  History,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileCheck,
  Shield,
  Trash2,
  Calendar,
  Layers,
  ChevronDown,
  Percent,
  Sliders,
  AlertTriangle,
  Info,
} from "lucide-react";

interface StoreDetail {
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
  pos_system_name: string | null;
  menu_slug: string;
  self_pickup_enabled: boolean;
  city?: { name_ar: string; name_en: string };
  merchant?: { commercial_name: string; cr_number: string };
  category?: { name_ar: string; name_en: string };
}

interface BranchItem {
  id: string;
  name_ar: string;
  name_en: string;
  city_id: string;
  latitude: number;
  longitude: number;
  address_text: string;
  working_hours: any;
  default_prep_time_minutes: number;
  min_order_halalas: number;
  is_active: boolean;
}

interface DocumentTypeItem {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  applies_to: string;
  is_mandatory: boolean;
  requires_expiry_date: boolean;
}

interface UploadedDocItem {
  id: string;
  document_type_id: string;
  entity_id: string;
  file_url: string;
  expiry_date: string | null;
  is_verified: boolean;
  document_type?: { name_ar: string; code: string; is_mandatory: boolean };
}

interface MenuSectionItem {
  id: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
  is_active: boolean;
}

interface MenuItemRecord {
  id: string;
  section_id: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  base_price_halalas: number;
  prep_time_minutes: number;
  is_available: boolean;
  is_published: boolean;
  calories_value: number | null;
  calories_min: number | null;
  calories_max: number | null;
  allergens: string[];
  is_sfda_exempt: boolean;
  sfda_exemption_reason_id: string | null;
  is_suggested_in_cart?: boolean;
}

interface ContractItem {
  id: string;
  valid_from: string;
  valid_until: string | null;
  pricing_model: string;
  contract_percentage: number;
  tier1_fee_halalas: number;
  tier1_order_threshold_halalas: number;
  tier2_fee_halalas: number;
  contract_per_customer_cap_halalas: number;
  payment_gateway_fee_percentage: number;
  payment_gateway_fee_fixed_halalas: number;
}

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params?.id as string;
  const { t, isRTL } = useLanguage();

  const [activeTab, setActiveTab] = useState<"branches" | "menu" | "contract" | "audit">("branches");
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // الفروع
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentTypeItem[]>([]);
  const [branchDocs, setBranchDocs] = useState<Record<string, UploadedDocItem[]>>({});
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [branchNameAr, setBranchNameAr] = useState("");
  const [branchNameEn, setBranchNameEn] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchLat, setBranchLat] = useState("24.7136");
  const [branchLng, setBranchLng] = useState("46.6753");
  const [branchPrepTime, setBranchPrepTime] = useState("20");
  const [branchMinOrder, setBranchMinOrder] = useState("0");

  // المستندات
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedBranchIdForDoc, setSelectedBranchIdForDoc] = useState<string | null>(null);
  const [docTypeId, setDocTypeId] = useState("");
  const [docFileUrl, setDocFileUrl] = useState("https://storage.mahallat.local/docs/sample.pdf");
  const [docExpiryDate, setDocExpiryDate] = useState("");

  // المنيو
  const [sections, setSections] = useState<MenuSectionItem[]>([]);
  const [menuItems, setMenuItems] = useState<Record<string, MenuItemRecord[]>>({});
  const [sfdaReasons, setSfdaReasons] = useState<{ id: string; code: string; reason_ar: string }[]>([]);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [sectionNameAr, setSectionNameAr] = useState("");
  const [sectionNameEn, setSectionNameEn] = useState("");

  // إضافة صنف
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [itemNameAr, setItemNameAr] = useState("");
  const [itemNameEn, setItemNameEn] = useState("");
  const [itemPriceSar, setItemPriceSar] = useState("25.00");
  const [itemPrepMinutes, setItemPrepMinutes] = useState("15");
  const [itemCalories, setItemCalories] = useState("");
  const [itemAllergens, setItemAllergens] = useState<string[]>([]);
  const [itemIsSfdaExempt, setItemIsSfdaExempt] = useState(false);
  const [itemSfdaReasonId, setItemSfdaReasonId] = useState("");
  const [itemAutoPublish, setItemAutoPublish] = useState(false);
  const [itemIsSuggestedInCart, setItemIsSuggestedInCart] = useState(false);

  // العقود
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [showNewContractModal, setShowNewContractModal] = useState(false);
  const [newPricingModel, setNewPricingModel] = useState<"percentage" | "per_customer" | "no_commission">("percentage");
  const [newPercentage, setNewPercentage] = useState("12.0");

  // سجل التدقيق
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const loadAllStoreData = async () => {
    try {
      setLoading(true);
      // 1. المتجر
      const { data: storeData, error: storeErr } = await supabase
        .from("stores")
        .select(`
          *,
          city:cities(name_ar, name_en),
          merchant:merchants(commercial_name, cr_number),
          category:store_categories(name_ar, name_en)
        `)
        .eq("id", storeId)
        .single();

      if (storeErr || !storeData) {
        setFeedbackMsg({ type: "error", text: "تعذر العثور على بيانات المتجر" });
        return;
      }
      setStore(storeData as unknown as StoreDetail);

      // 2. الفروع
      const { data: branchData } = await (supabase.rpc as any)("get_store_branches", { p_store_id: storeId });
      setBranches((branchData as unknown as BranchItem[]) || []);

      // 3. أنواع المستندات
      const { data: dtData } = await supabase.from("document_types").select("*").order("name_ar");
      setDocTypes(dtData || []);
      if (dtData && dtData.length > 0) {
        setDocTypeId(dtData[0].id);
      }

      // 4. مستندات الفروع
      if (branchData && branchData.length > 0) {
        const branchIds = (branchData as any[]).map((b) => b.id);
        const { data: docs } = await supabase
          .from("uploaded_documents")
          .select("*, document_type:document_types(name_ar, code, is_mandatory)")
          .eq("entity_type", "branch")
          .in("entity_id", branchIds);

        const map: Record<string, UploadedDocItem[]> = {};
        docs?.forEach((d: any) => {
          if (!map[d.entity_id]) map[d.entity_id] = [];
          map[d.entity_id].push(d);
        });
        setBranchDocs(map);
      }

      // 5. أقسام المنيو وأصنافه
      const { data: secData } = await supabase
        .from("menu_sections")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order");
      setSections(secData || []);

      if (secData && secData.length > 0) {
        const secIds = secData.map((s) => s.id);
        const { data: itemData } = await supabase
          .from("menu_items")
          .select("*")
          .in("section_id", secIds)
          .order("created_at");

        const itemMap: Record<string, MenuItemRecord[]> = {};
        itemData?.forEach((it: any) => {
          if (!itemMap[it.section_id]) itemMap[it.section_id] = [];
          itemMap[it.section_id].push(it);
        });
        setMenuItems(itemMap);
      }

      // 6. أسباب إعفاء SFDA
      const { data: sfdaData } = await supabase.from("sfda_exemption_reasons").select("*").order("code");
      setSfdaReasons(sfdaData || []);
      if (sfdaData && sfdaData.length > 0) {
        setItemSfdaReasonId(sfdaData[0].id);
      }

      // 7. العقود
      const { data: contractData } = await supabase
        .from("store_contracts")
        .select("*")
        .eq("store_id", storeId)
        .order("valid_from", { ascending: false });
      setContracts((contractData as unknown as ContractItem[]) || []);

      // 8. سجل التدقيق
      const { data: logs } = await supabase
        .from("audit_log")
        .select("*")
        .eq("record_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      setAuditLogs(logs || []);
    } catch (err: any) {
      console.error(err);
      setFeedbackMsg({ type: "error", text: err.message || "حدث خطأ أثناء تحميل البيانات" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      loadAllStoreData();
    }
  }, [storeId]);

  // إضافة فرع جديد
  const handleCreateBranch = async () => {
    try {
      setFeedbackMsg(null);
      if (!branchNameAr.trim()) {
        setFeedbackMsg({ type: "error", text: "اسم الفرع بالعربية مطلوب" });
        return;
      }

      const lat = parseFloat(branchLat);
      const lng = parseFloat(branchLng);
      if (isNaN(lat) || isNaN(lng)) {
        setFeedbackMsg({ type: "error", text: "الإحداثيات الجغرافية غير صالحة" });
        return;
      }

      const { data: newBranchId, error } = await (supabase.rpc as any)("admin_save_branch", {
        p_id: null,
        p_store_id: storeId,
        p_name_ar: branchNameAr.trim(),
        p_name_en: branchNameEn.trim() || branchNameAr.trim(),
        p_city_id: store!.city_id,
        p_latitude: lat,
        p_longitude: lng,
        p_address_text: branchAddress.trim() || "العنوان غير محدد",
        p_working_hours: [{ day: "sunday", open: "08:00", close: "23:00" }],
        p_default_prep_time_minutes: parseInt(branchPrepTime, 10) || 20,
        p_min_order_halalas: Math.round(parseFloat(branchMinOrder || "0") * 100),
        p_is_active: false,
      });

      if (error) throw error;

      setShowAddBranchModal(false);
      setBranchNameAr("");
      setBranchNameEn("");
      setBranchAddress("");
      setFeedbackMsg({ type: "success", text: "تمت إضافة الفرع بنجاح، يمكنك الآن إرفاق مستنداته وتفعيله" });
      await loadAllStoreData();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "تعذر إضافة الفرع" });
    }
  };

  // تفعيل / تعطيل الفرع مع فحص المستندات الإلزامية (MER-001)
  const handleToggleBranchActive = async (branch: BranchItem) => {
    try {
      setFeedbackMsg(null);
      const newStatus = !branch.is_active;

      const { error } = await supabase
        .from("store_branches")
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq("id", branch.id);

      if (error) {
        // رسالة الخطأ تأتي مباشرة من التريجر (MER-001) إذا نقص مستند
        throw error;
      }

      setFeedbackMsg({
        type: "success",
        text: newStatus ? "تم تفعيل الفرع بنجاح (المستندات سارية)" : "تم تعطيل الفرع مؤقتاً",
      });
      await loadAllStoreData();
    } catch (e: any) {
      setFeedbackMsg({
        type: "error",
        text: e.message?.includes("مستند إلزامي")
          ? `⚠️ ${e.message}`
          : e.message || "حدث خطأ أثناء تعديل حالة الفرع",
      });
    }
  };

  // إرفاق مستند لفرع
  const handleUploadDoc = async () => {
    try {
      setFeedbackMsg(null);
      if (!selectedBranchIdForDoc || !docTypeId) return;

      const { error } = await supabase.from("uploaded_documents").insert({
        document_type_id: docTypeId,
        entity_type: "branch",
        entity_id: selectedBranchIdForDoc,
        file_url: docFileUrl || "https://storage.mahallat.local/docs/doc.pdf",
        expiry_date: docExpiryDate || null,
        is_verified: true,
      });

      if (error) throw error;

      setShowDocModal(false);
      setDocExpiryDate("");
      setFeedbackMsg({ type: "success", text: "تم تسجيل المستند بنجاح" });
      await loadAllStoreData();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "تعذر تسجيل المستند" });
    }
  };

  // إضافة قسم منيو
  const handleCreateSection = async () => {
    try {
      setFeedbackMsg(null);
      if (!sectionNameAr.trim()) {
        setFeedbackMsg({ type: "error", text: "اسم القسم بالعربية مطلوب" });
        return;
      }

      const { error } = await supabase.from("menu_sections").insert({
        store_id: storeId,
        name_ar: sectionNameAr.trim(),
        name_en: sectionNameEn.trim() || sectionNameAr.trim(),
        sort_order: sections.length + 1,
      });

      if (error) throw error;

      setShowAddSectionModal(false);
      setSectionNameAr("");
      setSectionNameEn("");
      setFeedbackMsg({ type: "success", text: "تم إنشاء القسم بنجاح" });
      await loadAllStoreData();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "تعذر إنشاء القسم" });
    }
  };

  // إضافة صنف منيو مع فحص مدة التحضير (MER-040) وفحص البيانات الغذائية عند النشر (MER-025)
  const handleCreateItem = async () => {
    try {
      setFeedbackMsg(null);
      if (!selectedSectionId) return;
      if (!itemNameAr.trim()) {
        setFeedbackMsg({ type: "error", text: "اسم الصنف بالعربية مطلوب" });
        return;
      }

      const prepMinutes = parseInt(itemPrepMinutes, 10);
      if (isNaN(prepMinutes) || prepMinutes <= 0) {
        setFeedbackMsg({ type: "error", text: "مدة التحضير يجب أن تكون رقماً أكبر من صفر" });
        return;
      }

      // فحص مدة التحضير 40 دقيقة (MER-040)
      if (prepMinutes > 40 && !store?.can_exceed_max_prep_time) {
        setFeedbackMsg({
          type: "error",
          text: "مدة التحضير تتجاوز 40 دقيقة، والمتجر ليس لديه صلاحية التجاوز (MER-040)",
        });
        return;
      }

      // فحص النشر والبيانات الغذائية (MER-025)
      const calVal = itemCalories ? parseInt(itemCalories, 10) : null;
      if (itemAutoPublish) {
        if (!calVal && !itemIsSfdaExempt) {
          setFeedbackMsg({
            type: "error",
            text: "لا يمكن نشر الصنف: ناقص حقول السعرات وغير موسوم بمعفى نظامياً مع تحديد السبب (MER-025)",
          });
          return;
        }
      }

      const { error } = await supabase.from("menu_items").insert({
        section_id: selectedSectionId,
        name_ar: itemNameAr.trim(),
        name_en: itemNameEn.trim() || itemNameAr.trim(),
        base_price_halalas: Math.round(parseFloat(itemPriceSar || "0") * 100),
        prep_time_minutes: prepMinutes,
        calories_value: calVal,
        allergens: itemAllergens,
        is_sfda_exempt: itemIsSfdaExempt,
        sfda_exemption_reason_id: itemIsSfdaExempt ? itemSfdaReasonId : null,
        is_published: itemAutoPublish,
        is_suggested_in_cart: itemIsSuggestedInCart,
      });

      if (error) throw error;

      setShowAddItemModal(false);
      setItemNameAr("");
      setItemNameEn("");
      setItemCalories("");
      setItemAllergens([]);
      setItemIsSfdaExempt(false);
      setItemIsSuggestedInCart(false);
      setFeedbackMsg({ type: "success", text: "تمت إضافة الصنف بنجاح" });
      await loadAllStoreData();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "تعذر إضافة الصنف" });
    }
  };

  // تبديل اقتراح الصنف في السلة (CRT-003)
  const handleToggleSuggestedItem = async (item: MenuItemRecord) => {
    try {
      const newVal = !item.is_suggested_in_cart;
      const { error } = await supabase
        .from("menu_items")
        .update({ is_suggested_in_cart: newVal })
        .eq("id", item.id);

      if (error) throw error;
      setFeedbackMsg({
        type: "success",
        text: newVal ? "تم تمييز الصنف ليُقترح في السلة" : "تم إلغاء اقتراح الصنف في السلة",
      });
      await loadAllStoreData();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "تعذر تعديل حالة الاقتراح" });
    }
  };

  // نشر / إلغاء نشر صنف (MER-025)
  const handleTogglePublishItem = async (item: MenuItemRecord) => {
    try {
      setFeedbackMsg(null);
      const newPublished = !item.is_published;

      const { error } = await supabase
        .from("menu_items")
        .update({ is_published: newPublished })
        .eq("id", item.id);

      if (error) {
        throw error;
      }

      setFeedbackMsg({
        type: "success",
        text: newPublished ? "تم نشر الصنف للعملاء بنجاح" : "تم تحويل الصنف إلى مسودة",
      });
      await loadAllStoreData();
    } catch (e: any) {
      setFeedbackMsg({
        type: "error",
        text: e.message?.includes("السعرات")
          ? `⚠️ رفض النشر: ${e.message}`
          : e.message || "فشل تغيير حالة النشر",
      });
    }
  };

  // إنشاء عقد جديد وتأريخ القديم (MER-001 / MER-009)
  const handleCreateNewContract = async () => {
    try {
      setFeedbackMsg(null);
      const { error } = await supabase.rpc("admin_create_store_contract", {
        p_store_id: storeId,
        p_pricing_model: newPricingModel,
        p_tier1_fee_halalas: 200,
        p_tier1_order_threshold_halalas: 2500,
        p_tier2_fee_halalas: 500,
        p_contract_per_customer_cap_halalas: 3000,
        p_contract_per_customer_period_days: 365,
        p_contract_percentage: parseFloat(newPercentage) || 10.0,
        p_menu_markup_percentage: 0.0,
        p_menu_markup_platform_share_percentage: 100.0,
        p_payment_gateway_fee_percentage: 2.5,
        p_payment_gateway_fee_fixed_halalas: 100,
        p_mart_pharmacy_merchant_percentage: 5.0,
        p_mart_pharmacy_customer_markup_percentage: 5.0,
        p_text_orders_platform_fee_percentage: 5.0,
      });

      if (error) throw error;

      setShowNewContractModal(false);
      setFeedbackMsg({ type: "success", text: "تم اعتماد العقد المالي الجديد وتأريخ العقد السابق بنجاح" });
      await loadAllStoreData();
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: e.message || "تعذر إنشاء العقد" });
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        {t.common.loading}
      </div>
    );
  }

  if (!store) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-xs text-slate-300">لم يتم العثور على المتجر</p>
        <Link href="/admin/stores" className="text-xs text-blue-400 hover:underline mt-3 inline-block">
          العودة لقائمة المتاجر
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* بطاقة معلومات المتجر الرئيسية */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/stores"
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
              {store.name_ar.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">{store.name_ar}</h1>
                <span className="text-xs text-slate-400">({store.name_en})</span>
                <span className="text-[10px] font-mono text-blue-400/80 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  mahallat.online/{store.menu_slug}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>المنشأة: {store.merchant?.commercial_name}</span>
                <span>·</span>
                <span>المدينة: {store.city?.name_ar}</span>
                <span>·</span>
                <span>القسم: {store.category?.name_ar || store.operation_type}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>تحضير: {store.default_prep_time_minutes} د</span>
              {store.can_exceed_max_prep_time && (
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                  استثناء &gt;40د
                </span>
              )}
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-slate-300">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>صلاحية المنيو: {store.menu_permission === "full" ? "كاملة" : store.menu_permission === "price_tolerance" ? `سماح ${store.menu_price_tolerance_percentage}%` : "بالمراجعة"}</span>
            </div>
          </div>
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

      {/* تبويبات ملف المتجر */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
        <button
          onClick={() => setActiveTab("branches")}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === "branches"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>{t.admin.stores.tabs.branches} ({branches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("menu")}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === "menu"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>{t.admin.stores.tabs.menu}</span>
        </button>

        <button
          onClick={() => setActiveTab("contract")}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === "contract"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t.admin.stores.tabs.contract} ({contracts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === "audit"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <History className="w-4 h-4" />
          <span>{t.admin.stores.tabs.audit}</span>
        </button>
      </div>

      {/* 1. تبويب الفروع */}
      {activeTab === "branches" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              {t.admin.branches.title}
            </h2>
            <button
              onClick={() => setShowAddBranchModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              {t.admin.branches.addBranch}
            </button>
          </div>

          {branches.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
              <p className="text-xs text-slate-400 mb-3">لا توجد فروع مسجلة لهذا المتجر حتى الآن</p>
              <button
                onClick={() => setShowAddBranchModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                {t.admin.branches.addBranch}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {branches.map((b) => {
                const docs = branchDocs[b.id] || [];
                const hasValidDocs = docs.some((d) => d.document_type?.is_mandatory);

                return (
                  <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{b.name_ar}</h3>
                          <span className="text-xs text-slate-400">({b.name_en})</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              b.is_active
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {b.is_active ? t.admin.branches.active : t.admin.branches.inactive}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{b.address_text}</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            ({b.latitude.toFixed(4)}, {b.longitude.toFixed(4)})
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedBranchIdForDoc(b.id);
                            setShowDocModal(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors"
                        >
                          <FileCheck className="w-3.5 h-3.5 text-blue-400" />
                          <span>{t.admin.branches.uploadDoc}</span>
                        </button>

                        <button
                          onClick={() => handleToggleBranchActive(b)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            b.is_active
                              ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                          }`}
                        >
                          {b.is_active ? (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              تعطيل الفرع
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              {t.admin.branches.activateBranch}
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* مستندات الفرع الرسمية (MER-001) */}
                    <div className="pt-3 border-t border-slate-800/80">
                      <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-blue-400" />
                        <span>المستندات الرسمية للفرع (MER-001):</span>
                      </div>

                      {docs.length === 0 ? (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>
                            تنبيه: لا توجد مستندات مرفوعة لهذا الفرع، وقاعدة البيانات ستمنع تفعيله حتى رفع المستند الإلزامي (رخصة البلدية).
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {docs.map((doc) => (
                            <div
                              key={doc.id}
                              className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-semibold text-white flex items-center gap-1">
                                  <span>{doc.document_type?.name_ar || "مستند"}</span>
                                  {doc.document_type?.is_mandatory && (
                                    <span className="text-[9px] text-amber-400 font-normal">(إلزامي)</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  انتهاء: {doc.expiry_date || "ساري بدون انتهاء"}
                                </div>
                              </div>
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                معتمد ✓
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. تبويب المنيو والمنتجات */}
      {activeTab === "menu" && (
        <div className="space-y-5">
          {store.store_type === "uncontracted" ? (
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">{t.admin.menu.uncontractedStoreMenuAlert}</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                وفقاً للمتطلب (MER-046)، المتاجر غير المتعاقدة تعمل بآلية «اطلب اللي تبي» ولا تتوفر لها قوائم منيو رقمية.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-blue-500" />
                    {t.admin.menu.title}
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    التحقق من البيانات الغذائية الإلزامية قبل النشر (MER-025) وسقف الـ 40 دقيقة (MER-040)
                  </p>
                </div>
                <button
                  onClick={() => setShowAddSectionModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  {t.admin.menu.addSection}
                </button>
              </div>

              {sections.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
                  <p className="text-xs text-slate-400 mb-3">لا توجد أقسام في المنيو حتى الآن</p>
                  <button
                    onClick={() => setShowAddSectionModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
                  >
                    {t.admin.menu.addSection}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {sections.map((sec) => {
                    const items = menuItems[sec.id] || [];

                    return (
                      <div key={sec.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{sec.name_ar}</h3>
                            <span className="text-xs text-slate-400">({sec.name_en})</span>
                            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                              {items.length} أصناف
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedSectionId(sec.id);
                              setShowAddItemModal(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {t.admin.menu.addItem}
                          </button>
                        </div>

                        {items.length === 0 ? (
                          <p className="text-xs text-slate-500 py-3 text-center">لا توجد أصناف في هذا القسم بعد</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {items.map((it) => (
                              <div
                                key={it.id}
                                className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h4 className="text-xs font-bold text-white">{it.name_ar}</h4>
                                      <span className="text-[10px] text-slate-400">{it.name_en}</span>
                                    </div>
                                    <span className="text-xs font-bold text-blue-400 font-mono">
                                      {(it.base_price_halalas / 100).toFixed(2)} ر.س
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap mt-2 text-[10px]">
                                    <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-300 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {it.prep_time_minutes} دقيقة
                                    </span>

                                    {it.is_sfda_exempt ? (
                                      <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                                        معفى نظامياً (SFDA)
                                      </span>
                                    ) : it.calories_value ? (
                                      <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-300">
                                        {it.calories_value} سعرة حرارية
                                      </span>
                                    ) : (
                                      <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded font-semibold">
                                        ⚠️ ينقصه السعرات (MER-025)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                        it.is_published
                                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                          : "bg-slate-800 text-slate-400 border-slate-700"
                                      }`}
                                    >
                                      {it.is_published ? t.admin.menu.published : t.admin.menu.draft}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleSuggestedItem(it)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                        it.is_suggested_in_cart
                                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                          : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                                      }`}
                                      title="تبديل الاقتراح في السلة (CRT-003)"
                                    >
                                      {it.is_suggested_in_cart ? "⭐ مقترح بالسلة" : "+ اقتراح"}
                                    </button>
                                  </div>

                                  <button
                                    onClick={() => handleTogglePublishItem(it)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                                      it.is_published
                                        ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                        : "bg-blue-600 hover:bg-blue-500 text-white"
                                    }`}
                                  >
                                    {it.is_published ? "إلغاء النشر" : t.admin.menu.publish}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 3. تبويب العقد المالي والرسوم */}
      {activeTab === "contract" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              {t.admin.stores.contractTitle} (المتطلب 12-fees.md و MER-001)
            </h2>
            <button
              onClick={() => setShowNewContractModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              {t.admin.stores.newContract}
            </button>
          </div>

          <div className="space-y-3">
            {contracts.map((c, idx) => {
              const isActive = !c.valid_until || new Date(c.valid_until) > new Date();

              return (
                <div
                  key={c.id}
                  className={`bg-slate-900 border rounded-2xl p-5 space-y-3 ${
                    isActive ? "border-blue-500/40 shadow-lg shadow-blue-500/5" : "border-slate-800 opacity-70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {c.pricing_model === "percentage"
                          ? "عقد النسبة المئوية"
                          : c.pricing_model === "per_customer"
                          ? "عقد الرسوم لكل عميل"
                          : "عقد بدون خصم"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {isActive ? "العقد الحالي النشط" : "عقد سابق مؤرخ"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      <span>من: {new Date(c.valid_from).toLocaleDateString("ar-SA")}</span>
                      {c.valid_until && <span> · إلى: {new Date(c.valid_until).toLocaleDateString("ar-SA")}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="bg-slate-950 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">نسبة المنصة</span>
                      <span className="text-xs font-bold text-white">{c.contract_percentage}%</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">رسم الدفع الإلكتروني</span>
                      <span className="text-xs font-bold text-white">
                        {c.payment_gateway_fee_percentage}% + {(c.payment_gateway_fee_fixed_halalas / 100).toFixed(2)} ر.س
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">شريحة 1 لكل عميل</span>
                      <span className="text-xs font-bold text-white">{(c.tier1_fee_halalas / 100).toFixed(2)} ر.س</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">السقف السنوي</span>
                      <span className="text-xs font-bold text-white">
                        {(c.contract_per_customer_cap_halalas / 100).toFixed(2)} ر.س
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. تبويب سجل التعديلات */}
      {activeTab === "audit" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-blue-500" />
            سجل التعديلات والتدقيق للمتجر (ADM-002)
          </h2>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">لا توجد سجلات تدقيق مسجلة لهذا المتجر حتى الآن</p>
          ) : (
            <div className="divide-y divide-slate-800 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200">{log.action}</span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-slate-300">{log.reason || "تعديل بواسطة النظام"}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(log.created_at).toLocaleString("ar-SA")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* مودال إضافة فرع */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              {t.admin.branches.addBranch}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">{t.admin.branches.branchNameAr} *</label>
                <input
                  type="text"
                  value={branchNameAr}
                  onChange={(e) => setBranchNameAr(e.target.value)}
                  placeholder="مثال: فرع العليا"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">{t.admin.branches.branchNameEn}</label>
                <input
                  type="text"
                  value={branchNameEn}
                  onChange={(e) => setBranchNameEn(e.target.value)}
                  placeholder="Example: Olaya Branch"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">{t.admin.branches.address}</label>
                <input
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="شارع العليا العام، بجوار برج المملكة"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-slate-300">خط العرض (Lat)</label>
                  <input
                    type="text"
                    value={branchLat}
                    onChange={(e) => setBranchLat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">خط الطول (Lng)</label>
                  <input
                    type="text"
                    value={branchLng}
                    onChange={(e) => setBranchLng(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddBranchModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateBranch}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                إضافة الفرع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال إرفاق مستند */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-400" />
              {t.admin.branches.uploadDoc}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">{t.admin.branches.docType}</label>
                <select
                  value={docTypeId}
                  onChange={(e) => setDocTypeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  {docTypes
                    .filter((dt) => dt.applies_to === "branch")
                    .map((dt) => (
                      <option key={dt.id} value={dt.id}>
                        {dt.name_ar} {dt.is_mandatory ? "(إلزامي)" : ""}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">{t.admin.branches.expiryDate}</label>
                <input
                  type="date"
                  value={docExpiryDate}
                  onChange={(e) => setDocExpiryDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleUploadDoc}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                حفظ واعتماد المستند
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال إضافة قسم */}
      {showAddSectionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              {t.admin.menu.addSection}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">اسم القسم (عربي) *</label>
                <input
                  type="text"
                  value={sectionNameAr}
                  onChange={(e) => setSectionNameAr(e.target.value)}
                  placeholder="مثال: الوجبات الرئيسية"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">اسم القسم (إنجليزي)</label>
                <input
                  type="text"
                  value={sectionNameEn}
                  onChange={(e) => setSectionNameEn(e.target.value)}
                  placeholder="Example: Main Dishes"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddSectionModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateSection}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                إنشاء القسم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال إضافة صنف منيو */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              {t.admin.menu.addItem}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">{t.admin.menu.itemNameAr} *</label>
                  <input
                    type="text"
                    value={itemNameAr}
                    onChange={(e) => setItemNameAr(e.target.value)}
                    placeholder="مثال: برجر دجاج مقرمش"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">{t.admin.menu.itemNameEn}</label>
                  <input
                    type="text"
                    value={itemNameEn}
                    onChange={(e) => setItemNameEn(e.target.value)}
                    placeholder="Crispy Chicken Burger"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">{t.admin.menu.basePrice}</label>
                  <input
                    type="number"
                    step="0.5"
                    value={itemPriceSar}
                    onChange={(e) => setItemPriceSar(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">
                    {t.admin.menu.prepTime} {store.can_exceed_max_prep_time ? "(مسموح >40)" : "(سقف 40 دقيقة)"}
                  </label>
                  <input
                    type="number"
                    max={store.can_exceed_max_prep_time ? 180 : 40}
                    value={itemPrepMinutes}
                    onChange={(e) => setItemPrepMinutes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* البيانات الغذائية (MER-025) */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="font-semibold text-white flex items-center justify-between">
                  <span>البيانات الغذائية (MER-025 - إلزامية للنشر)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-normal text-[11px]">
                    <input
                      type="checkbox"
                      checked={itemIsSfdaExempt}
                      onChange={(e) => setItemIsSfdaExempt(e.target.checked)}
                      className="accent-blue-600 rounded"
                    />
                    <span>معفى من السعرات (SFDA)</span>
                  </label>
                </div>

                {!itemIsSfdaExempt ? (
                  <div className="space-y-1">
                    <label className="text-slate-400 text-[11px]">السعرات الحرارية (كالوري)</label>
                    <input
                      type="number"
                      placeholder="مثال: 540"
                      value={itemCalories}
                      onChange={(e) => setItemCalories(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-slate-400 text-[11px]">سبب الإعفاء النظامي من هيئة الغذاء والدواء</label>
                    <select
                      value={itemSfdaReasonId}
                      onChange={(e) => setItemSfdaReasonId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs"
                    >
                      {sfdaReasons.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code}: {r.reason_ar}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoPublishCheck"
                  checked={itemAutoPublish}
                  onChange={(e) => setItemAutoPublish(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
                <label htmlFor="autoPublishCheck" className="text-xs text-slate-300 cursor-pointer">
                  نشر الصنف مباشرة للعملاء (يشترط اكتمال السعرات أو الإعفاء MER-025)
                </label>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="suggestedInCartCheck"
                  checked={itemIsSuggestedInCart}
                  onChange={(e) => setItemIsSuggestedInCart(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <label htmlFor="suggestedInCartCheck" className="text-xs text-slate-300 cursor-pointer">
                  ⭐ يُقترح في السلة لزيادة المبيعات (CRT-003)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateItem}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                حفظ الصنف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال عقد جديد */}
      {showNewContractModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              {t.admin.stores.newContract}
            </h3>
            <p className="text-xs text-slate-400">
              إنشاء عقد مالي جديد سيقوم تلقائياً بتأريخ العقد السابق وحفظ نسخته دون حذفه (MER-001).
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">نموذج العقد</label>
                <select
                  value={newPricingModel}
                  onChange={(e) => setNewPricingModel(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="percentage">نسبة مئوية</option>
                  <option value="per_customer">رسوم لكل عميل</option>
                  <option value="no_commission">بدون خصم</option>
                </select>
              </div>

              {newPricingModel === "percentage" && (
                <div className="space-y-1">
                  <label className="text-slate-300">نسبة المنصة المقتطعة (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newPercentage}
                    onChange={(e) => setNewPercentage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewContractModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateNewContract}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                اعتماد العقد الجديد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
