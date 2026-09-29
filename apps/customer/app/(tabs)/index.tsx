import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "../../context/LanguageContext";
import { useAddress } from "../../context/AddressContext";
import { supabase } from "../../lib/supabase";
import { formatMoney } from "@mahallat/shared";

interface SectionTab {
  key: string;
  nameAr: string;
  nameEn: string;
  icon: keyof typeof Ionicons.glyphMap;
  settingKey?: string;
  defaultEnabled: boolean;
}

const SECTION_TABS: SectionTab[] = [
  {
    key: "all",
    nameAr: "الكل",
    nameEn: "All",
    icon: "grid-outline",
    defaultEnabled: true,
  },
  {
    key: "restaurants",
    nameAr: "مطاعم",
    nameEn: "Restaurants",
    icon: "restaurant-outline",
    settingKey: "section_restaurants_enabled",
    defaultEnabled: true,
  },
  {
    key: "retail",
    nameAr: "محلات متنوعة",
    nameEn: "Retail",
    icon: "bag-handle-outline",
    settingKey: "section_retail_enabled",
    defaultEnabled: true,
  },
  {
    key: "mart",
    nameAr: "مارت",
    nameEn: "Mart",
    icon: "cart-outline",
    settingKey: "section_mart_enabled",
    defaultEnabled: true,
  },
  {
    key: "pharmacy",
    nameAr: "صيدليات",
    nameEn: "Pharmacies",
    icon: "medkit-outline",
    settingKey: "section_pharmacy_enabled",
    defaultEnabled: false, // مخفي افتراضياً حتى استيفاء الاشتراطات (CUS-009)
  },
  {
    key: "self_pickup",
    nameAr: "استلم بنفسك",
    nameEn: "Pickup",
    icon: "walk-outline",
    settingKey: "section_self_pickup_enabled",
    defaultEnabled: true,
  },
];

interface CategoryItem {
  id: string;
  name_ar: string;
  name_en: string;
}

interface StoreItem {
  store_id: string;
  store_name_ar: string;
  store_name_en: string;
  logo_url: string | null;
  banner_url: string | null;
  store_type: string;
  operation_type: string;
  category_name_ar: string | null;
  category_name_en: string | null;
  serving_branch_id: string;
  serving_branch_name_ar: string;
  distance_km: number;
  is_open: boolean;
  next_open_at: string | null;
  closes_at: string | null;
  min_order_halalas: number;
  delivery_fee_halalas: number;
  estimated_time_range: string;
  self_pickup_enabled: boolean;
  self_pickup_discount_percentage: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const { lang, isRTL } = useLanguage();
  const { currentAddress, guestLocation, currentDisplayLabel } = useAddress();

  const activeLat = currentAddress?.latitude ?? guestLocation?.latitude ?? null;
  const activeLng = currentAddress?.longitude ?? guestLocation?.longitude ?? null;

  const [activeSection, setActiveSection] = useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loadingStores, setLoadingStores] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [enabledSections, setEnabledSections] = useState<SectionTab[]>(SECTION_TABS);

  // 1. فحص ظهور الأقسام وفق إعدادات المدينة (CUS-009)
  useEffect(() => {
    async function filterSections() {
      try {
        const checked = await Promise.all(
          SECTION_TABS.map(async (sec) => {
            if (!sec.settingKey) return { ...sec, enabled: true };
            const { data } = await supabase.rpc("get_setting", {
              p_key: sec.settingKey,
            });
            const isEnabled = data !== null && data !== undefined ? Boolean(data) : sec.defaultEnabled;
            return { ...sec, enabled: isEnabled };
          })
        );
        setEnabledSections(checked.filter((s) => s.enabled));
      } catch {
        setEnabledSections(SECTION_TABS.filter((s) => s.defaultEnabled));
      }
    }
    filterSections();
  }, []);

  // 2. جلب التصنيفات للقسم المختار
  useEffect(() => {
    async function loadCategories() {
      if (activeSection === "all" || activeSection === "self_pickup") {
        const { data } = await supabase
          .from("store_categories")
          .select("id, name_ar, name_en")
          .order("name_ar");
        setCategories(data || []);
      } else {
        const { data } = await supabase
          .from("store_categories")
          .select("id, name_ar, name_en")
          .eq("section_key", activeSection)
          .order("name_ar");
        setCategories(data || []);
      }
    }
    loadCategories();
    setSelectedCategoryId(null);
  }, [activeSection]);

  // 3. جلب المتاجر المؤهلة لعنوان العميل عبر الخادم (stores_for_point)
  const fetchStores = useCallback(async () => {
    if (activeLat === null || activeLng === null) {
      setStores([]);
      return;
    }

    setLoadingStores(true);
    try {
      const sectionParam = activeSection === "all" ? undefined : activeSection;
      const { data, error } = await supabase.rpc("stores_for_point", {
        p_lat: activeLat,
        p_lng: activeLng,
        p_section: sectionParam,
        p_category_id: selectedCategoryId || undefined,
      });

      if (!error && data) {
        setStores(data as StoreItem[]);
      } else {
        setStores([]);
      }
    } catch {
      setStores([]);
    } finally {
      setLoadingStores(false);
      setRefreshing(false);
    }
  }, [activeLat, activeLng, activeSection, selectedCategoryId]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStores();
  };

  const formatOpenTime = (isoString: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* الرأس: اختيار العنوان والتوصيل (CUS-002) */}
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <TouchableOpacity
          style={[styles.locationSelector, { flexDirection: isRTL ? "row-reverse" : "row" }]}
          onPress={() => router.push("/address/select")}
        >
          <View style={styles.locationPinIcon}>
            <Ionicons name="location" size={18} color="#2563EB" />
          </View>
          <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", flex: 1, marginHorizontal: 8 }}>
            <Text style={styles.deliverToLabel}>
              {lang === "ar" ? "التوصيل إلى" : "Deliver to"}
            </Text>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 4 }}>
              <Text style={styles.locationTitle} numberOfLines={1}>
                {currentDisplayLabel}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#64748B" />
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mapIconButton} onPress={() => router.push("/address/new")}>
          <Ionicons name="map-outline" size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* خانة البحث المعطلة (قريباً في المرحلة 11) */}
        <View style={[styles.searchBar, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <Text style={[styles.searchText, { textAlign: isRTL ? "right" : "left" }]}>
            {lang === "ar" ? "ابحث عن متجر أو طبق... (قريباً)" : "Search store or dish... (Soon)"}
          </Text>
        </View>

        {/* شريط الأقسام (CUS-009) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.sectionsScroll, { flexDirection: isRTL ? "row-reverse" : "row" }]}
        >
          {enabledSections.map((sec) => {
            const isActive = activeSection === sec.key;
            const title = lang === "ar" ? sec.nameAr : sec.nameEn;
            return (
              <TouchableOpacity
                key={sec.key}
                style={[styles.sectionPill, isActive && styles.sectionPillActive]}
                onPress={() => setActiveSection(sec.key)}
              >
                <Ionicons
                  name={sec.icon}
                  size={16}
                  color={isActive ? "#FFFFFF" : "#475569"}
                  style={{ marginHorizontal: 4 }}
                />
                <Text style={[styles.sectionPillText, isActive && styles.sectionPillTextActive]}>
                  {title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* شريط التصنيفات الفرعية */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.categoriesScroll, { flexDirection: isRTL ? "row-reverse" : "row" }]}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategoryId === null && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategoryId(null)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategoryId === null && styles.categoryChipTextActive,
                ]}
              >
                {lang === "ar" ? "الكل" : "All"}
              </Text>
            </TouchableOpacity>

            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              const catName = lang === "ar" ? cat.name_ar : cat.name_en;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                  onPress={() => setSelectedCategoryId(cat.id)}
                >
                  <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                    {catName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* تنبيه الاستلام الذاتي (المرحلة 9) */}
        {activeSection === "self_pickup" && (
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle" size={18} color="#7C3AED" />
            <Text style={styles.noticeText}>
              {lang === "ar"
                ? "خدمة الاستلام من الفرع بخصم خاص. الطلب بالاستلام متاح للتجربة قريباً (المرحلة 9)."
                : "Pickup service with special discounts. Self-pickup ordering available soon (Phase 9)."}
            </Text>
          </View>
        )}

        {/* تنبيه عند عدم اختيار عنوان بعد */}
        {activeLat === null && (
          <View style={styles.noAddressCard}>
            <Ionicons name="location-outline" size={36} color="#2563EB" />
            <Text style={styles.noAddressTitle}>
              {lang === "ar" ? "حدد عنوان التوصيل" : "Select delivery address"}
            </Text>
            <Text style={styles.noAddressSub}>
              {lang === "ar"
                ? "اختر موقعك لعرض المتاجر والرسوم وأوقات التوصيل المتاحة لعنوانك"
                : "Pick your location to see stores, fees and delivery estimates"}
            </Text>
            <TouchableOpacity
              style={styles.chooseAddressBtn}
              onPress={() => router.push("/address/select")}
            >
              <Text style={styles.chooseAddressBtnText}>
                {lang === "ar" ? "اختيار العنوان الآن" : "Select Address Now"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* حالة التحميل */}
        {loadingStores && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loaderText}>
              {lang === "ar" ? "جاري تحميل المتاجر المتاحة..." : "Loading available stores..."}
            </Text>
          </View>
        )}

        {/* قائمة المتاجر */}
        {!loadingStores && activeLat !== null && stores.length > 0 && (
          <View style={styles.storesList}>
            {stores.map((store) => {
              const storeName = lang === "ar" ? store.store_name_ar : store.store_name_en;
              const catName = lang === "ar" ? store.category_name_ar : store.category_name_en;
              const deliveryFeeText =
                store.delivery_fee_halalas === 0
                  ? lang === "ar" ? "توصيل مجاني" : "Free Delivery"
                  : formatMoney(store.delivery_fee_halalas);

              return (
                <TouchableOpacity
                  key={store.store_id}
                  style={styles.storeCard}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: `/store/${store.store_id}` as any,
                      params: { section: activeSection },
                    })
                  }
                >
                  {/* صورة البانر */}
                  <View style={styles.bannerContainer}>
                    {store.banner_url ? (
                      <Image source={{ uri: store.banner_url }} style={styles.bannerImage} />
                    ) : (
                      <View style={[styles.bannerPlaceholder, { backgroundColor: "#E2E8F0" }]}>
                        <Ionicons name="restaurant" size={32} color="#94A3B8" />
                      </View>
                    )}

                    {/* شارة الحالة (مفتوح / مغلق بموعد الفتح) */}
                    <View
                      style={[
                        styles.statusBadge,
                        store.is_open ? styles.statusBadgeOpen : styles.statusBadgeClosed,
                        { [isRTL ? "right" : "left"]: 12 },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: store.is_open ? "#16A34A" : "#DC2626" },
                        ]}
                      />
                      <Text style={styles.statusText}>
                        {store.is_open
                          ? lang === "ar" ? "مفتوح" : "Open"
                          : store.next_open_at
                          ? lang === "ar"
                            ? `مغلق · يفتح ${formatOpenTime(store.next_open_at)}`
                            : `Closed · Opens ${formatOpenTime(store.next_open_at)}`
                          : lang === "ar" ? "مغلق حالياً" : "Closed now"}
                      </Text>
                    </View>

                    {/* شارة خصم الاستلام الذاتي إن وُجد */}
                    {store.self_pickup_discount_percentage > 0 && (
                      <View
                        style={[
                          styles.pickupBadge,
                          { [isRTL ? "left" : "right"]: 12 },
                        ]}
                      >
                        <Text style={styles.pickupBadgeText}>
                          {lang === "ar"
                            ? `خصم ${store.self_pickup_discount_percentage}% بالاستلام`
                            : `${store.self_pickup_discount_percentage}% off pickup`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* تفاصيل المتجر */}
                  <View style={styles.storeInfo}>
                    <View style={[styles.storeTitleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                      {/* الشعار */}
                      {store.logo_url ? (
                        <Image source={{ uri: store.logo_url }} style={styles.logoImage} />
                      ) : (
                        <View style={styles.logoPlaceholder}>
                          <Text style={styles.logoLetter}>{storeName.charAt(0)}</Text>
                        </View>
                      )}

                      <View style={{ flex: 1, marginHorizontal: 8, alignItems: isRTL ? "flex-end" : "flex-start" }}>
                        <Text style={styles.storeNameText} numberOfLines={1}>
                          {storeName}
                        </Text>
                        {catName && <Text style={styles.categoryText}>{catName}</Text>}
                      </View>
                    </View>

                    {/* بيانات التوصيل والأوقات والرسوم */}
                    <View style={[styles.metaRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                      <View style={[styles.metaItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                        <Ionicons name="time-outline" size={14} color="#64748B" />
                        <Text style={styles.metaText}>{store.estimated_time_range}</Text>
                      </View>

                      <View style={styles.metaDivider} />

                      <View style={[styles.metaItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                        <Ionicons name="navigate-outline" size={14} color="#64748B" />
                        <Text style={styles.metaText}>{store.distance_km} {lang === "ar" ? "كم" : "km"}</Text>
                      </View>

                      <View style={styles.metaDivider} />

                      <View style={[styles.metaItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                        <Ionicons name="bicycle-outline" size={14} color="#64748B" />
                        <Text style={styles.metaText}>{deliveryFeeText}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* حالة عدم وجود متاجر تخدم العنوان */}
        {!loadingStores && activeLat !== null && stores.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>
              {lang === "ar" ? "لا توجد متاجر متاحة حالياً" : "No stores available"}
            </Text>
            <Text style={styles.emptyDesc}>
              {lang === "ar"
                ? "لا توجد متاجر تخدم موقعك في هذا القسم حالياً، جرب اختيار قسم آخر أو تغيير العنوان."
                : "No stores currently serve your location in this section. Try picking another section or changing address."}
            </Text>
            <TouchableOpacity
              style={styles.changeAddressBtn}
              onPress={() => router.push("/address/select")}
            >
              <Text style={styles.changeAddressBtnText}>
                {lang === "ar" ? "تغيير العنوان" : "Change Address"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    alignItems: "center",
  },
  locationSelector: {
    flex: 1,
    alignItems: "center",
  },
  locationPinIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  deliverToLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  locationTitle: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "700",
    maxWidth: 220,
  },
  mapIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    paddingBottom: 40,
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  searchText: {
    fontSize: 13,
    color: "#94A3B8",
    flex: 1,
  },
  sectionsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  sectionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionPillActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  sectionPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  sectionPillTextActive: {
    color: "#FFFFFF",
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 6,
  },
  categoryChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryChipActive: {
    backgroundColor: "#DBEAFE",
  },
  categoryChipText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: "#1E40AF",
    fontWeight: "700",
  },
  noticeBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#F3E8FF",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noticeText: {
    fontSize: 12,
    color: "#6B21A8",
    flex: 1,
  },
  noAddressCard: {
    margin: 16,
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  noAddressTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 8,
  },
  noAddressSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  chooseAddressBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  chooseAddressBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loaderText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
  },
  storesList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  storeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bannerContainer: {
    width: "100%",
    height: 140,
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  bannerPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  statusBadge: {
    position: "absolute",
    top: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusBadgeOpen: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  statusBadgeClosed: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
  },
  pickupBadge: {
    position: "absolute",
    top: 10,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pickupBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  storeInfo: {
    padding: 12,
  },
  storeTitleRow: {
    alignItems: "center",
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  logoLetter: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2563EB",
  },
  storeNameText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  categoryText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  metaRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    alignItems: "center",
    gap: 8,
  },
  metaItem: {
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#CBD5E1",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  changeAddressBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  changeAddressBtnText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "600",
  },
});
