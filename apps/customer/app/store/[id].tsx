import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLanguage } from "../../context/LanguageContext";
import { useAddress } from "../../context/AddressContext";
import { useCart } from "../../context/CartContext";
import { supabase } from "../../lib/supabase";
import { formatMoney, formatCaloriesDisplay } from "@mahallat/shared";
import ItemCustomizationModal, {
  MenuItemData,
  SelectedCustomization,
} from "../../components/ItemCustomizationModal";

interface StoreHeaderData {
  store_id: string;
  store_name_ar: string;
  store_name_en: string;
  store_type: string;
  operation_type: string;
  logo_url: string | null;
  banner_url: string | null;
  category_name_ar?: string | null;
  category_name_en?: string | null;
  is_open?: boolean;
  next_open_at?: string | null;
  min_order_halalas?: number;
  delivery_fee_halalas?: number;
  estimated_time_range?: string;
  self_pickup_enabled?: boolean;
  self_pickup_discount_percentage?: number;
}

interface MenuSection {
  id: string;
  name_ar: string;
  name_en: string;
  items: MenuItemData[];
}

export default function StoreDetailScreen() {
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const router = useRouter();
  const { lang, isRTL } = useLanguage();
  const { currentAddress, guestLocation } = useAddress();

  const activeLat = currentAddress?.latitude ?? guestLocation?.latitude ?? null;
  const activeLng = currentAddress?.longitude ?? guestLocation?.longitude ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storeHeader, setStoreHeader] = useState<StoreHeaderData | null>(null);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // حالة صنف التخصيص
  const [selectedItemForModal, setSelectedItemForModal] = useState<MenuItemData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ربط سلة التسوق الحقيقية (CRT-001)
  const {
    addItem,
    confirmSwitchAndAdd,
    items: cartItems,
    itemCount,
    quote: cartQuote,
    storeId: cartStoreId,
  } = useCart();

  const fetchStoreData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    try {
      // 1. جلب المنيو والبيانات الأساسية للمتجر عبر RPC
      const { data: menuData, error: menuErr } = await supabase.rpc("customer_menu", {
        p_store_id: id,
      });

      if (menuErr || !menuData) {
        throw new Error(menuErr?.message || "Failed to load store menu");
      }

      const rawMenu = menuData as any;
      const rawSections = (rawMenu?.sections || []) as MenuSection[];
      setSections(rawSections);
      if (rawSections.length > 0 && !activeSectionId) {
        setActiveSectionId(rawSections[0].id);
      }

      // 2. جلب بيانات التغطية والأوقات والرسوم لفرع المتجر الخادم
      let branchInfo: Partial<StoreHeaderData> = {};
      if (activeLat !== null && activeLng !== null) {
        const { data: nearbyStores } = await supabase.rpc("stores_for_point", {
          p_lat: activeLat,
          p_lng: activeLng,
        });

        if (nearbyStores && Array.isArray(nearbyStores)) {
          const match = nearbyStores.find((s) => s.store_id === id);
          if (match) {
            branchInfo = {
              is_open: match.is_open,
              next_open_at: match.next_open_at,
              min_order_halalas: match.min_order_halalas,
              delivery_fee_halalas: match.delivery_fee_halalas,
              estimated_time_range: match.estimated_time_range,
              category_name_ar: match.category_name_ar,
              category_name_en: match.category_name_en,
              self_pickup_enabled: match.self_pickup_enabled,
              self_pickup_discount_percentage: match.self_pickup_discount_percentage,
            };
          }
        }
      }

      // ضبط بيانات الرأس
      setStoreHeader({
        store_id: rawMenu.store_id,
        store_name_ar: rawMenu.store_name_ar,
        store_name_en: rawMenu.store_name_en,
        store_type: rawMenu.store_type,
        operation_type: rawMenu.operation_type,
        logo_url: rawMenu.logo_url,
        banner_url: rawMenu.banner_url,
        ...branchInfo,
      });
    } catch (err) {
      console.error("Error loading store detail:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, activeLat, activeLng]);

  useEffect(() => {
    fetchStoreData();
  }, [fetchStoreData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStoreData();
  };

  const handleOpenItem = (item: MenuItemData) => {
    setSelectedItemForModal(item);
    setModalVisible(true);
  };

  const handleAddToCart = (customization: SelectedCustomization) => {
    const sName = storeHeader
      ? lang === "ar"
        ? storeHeader.store_name_ar
        : storeHeader.store_name_en
      : "";

    const addParams = {
      storeId: id as string,
      storeName: sName,
      item: {
        id: customization.item.id,
        name_ar: customization.item.name_ar,
        name_en: customization.item.name_en,
        image_url: customization.item.image_url,
        customer_price_halalas: customization.item.customer_price_halalas,
      },
      size: customization.size
        ? {
            id: customization.size.id,
            name_ar: customization.size.name_ar,
            name_en: customization.size.name_en,
            customer_price_halalas: customization.size.customer_price_halalas,
          }
        : null,
      options: customization.options.map((o) => ({
        id: o.id,
        name_ar: o.name_ar,
        price_delta_halalas: o.price_delta_halalas,
      })),
      quantity: customization.quantity,
      note: customization.note,
    };

    const res = addItem(addParams);

    if (res.requiresSwitchConfirmation) {
      Alert.alert(
        lang === "ar" ? "تغيير المتجر؟" : "Switch Store?",
        lang === "ar"
          ? `سلتك الحالية تحتوي على أصناف من «${res.currentStoreName}». هل تريد تفريغها والبدء بهذا المتجر؟`
          : `Your cart contains items from "${res.currentStoreName}". Clear and start with this store?`,
        [
          { text: lang === "ar" ? "إلغاء" : "Cancel", style: "cancel" },
          {
            text: lang === "ar" ? "تفريغ والبدء" : "Clear & Start",
            style: "destructive",
            onPress: () => confirmSwitchAndAdd(addParams),
          },
        ]
      );
    }
  };

  const formatOpenTime = (isoString: string | null | undefined) => {
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

  const storeName = storeHeader
    ? lang === "ar"
      ? storeHeader.store_name_ar
      : storeHeader.store_name_en
    : "";

  const isSelfPickupSection = section === "self_pickup";
  const isNonRegisteredOrPaper =
    storeHeader?.store_type === "contract_paper" || storeHeader?.store_type === "unregistered";

  const minOrderHalalas = storeHeader?.min_order_halalas || 0;

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            {lang === "ar" ? "جاري تحميل تفاصيل المتجر..." : "Loading store details..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!storeHeader) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
          <Text style={styles.errorTitle}>
            {lang === "ar" ? "تعذر العثور على المتجر" : "Store not found"}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>
              {lang === "ar" ? "العودة للرئيسية" : "Back to Home"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* الشريط العلوي مع زر الرجوع */}
      <View style={[styles.navHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons
            name={isRTL ? "chevron-forward" : "chevron-back"}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {storeName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* صورة البانر */}
        <View style={styles.bannerContainer}>
          {storeHeader.banner_url ? (
            <Image source={{ uri: storeHeader.banner_url }} style={styles.bannerImage} />
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Ionicons name="restaurant" size={48} color="#94A3B8" />
            </View>
          )}
        </View>

        {/* كرت معلومات المتجر */}
        <View style={styles.storeHeaderCard}>
          <View style={[styles.logoNameRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {storeHeader.logo_url ? (
              <Image source={{ uri: storeHeader.logo_url }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoLetter}>{storeName.charAt(0)}</Text>
              </View>
            )}

            <View style={{ flex: 1, marginHorizontal: 12, alignItems: isRTL ? "flex-end" : "flex-start" }}>
              <Text style={styles.storeNameText}>{storeName}</Text>
              {storeHeader.category_name_ar && (
                <Text style={styles.categoryText}>
                  {lang === "ar" ? storeHeader.category_name_ar : storeHeader.category_name_en}
                </Text>
              )}
            </View>
          </View>

          {/* حالة الفرع وأوقات العمل والرسوم (CUS-005) */}
          <View style={[styles.metaBadgesRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {/* شارة مفتوح / مغلق بموعد الفتح */}
            <View
              style={[
                styles.statusBadge,
                storeHeader.is_open ? styles.statusBadgeOpen : styles.statusBadgeClosed,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: storeHeader.is_open ? "#16A34A" : "#DC2626" },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: storeHeader.is_open ? "#15803D" : "#B91C1C" },
                ]}
              >
                {storeHeader.is_open
                  ? lang === "ar" ? "مفتوح لاستقبال الطلبات" : "Open for Orders"
                  : storeHeader.next_open_at
                  ? lang === "ar"
                    ? `مغلق · يفتح ${formatOpenTime(storeHeader.next_open_at)}`
                    : `Closed · Opens ${formatOpenTime(storeHeader.next_open_at)}`
                  : lang === "ar" ? "مغلق حالياً" : "Closed now"}
              </Text>
            </View>
          </View>

          {/* تفاصيل التوصيل والحد الأدنى */}
          <View style={[styles.deliveryInfoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {storeHeader.estimated_time_range && (
              <View style={[styles.deliveryInfoItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Ionicons name="time-outline" size={16} color="#64748B" />
                <Text style={styles.deliveryInfoText}>{storeHeader.estimated_time_range}</Text>
              </View>
            )}

            {storeHeader.delivery_fee_halalas !== undefined && (
              <View style={[styles.deliveryInfoItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Ionicons name="bicycle-outline" size={16} color="#64748B" />
                <Text style={styles.deliveryInfoText}>
                  {storeHeader.delivery_fee_halalas === 0
                    ? lang === "ar" ? "توصيل مجاني" : "Free Delivery"
                    : formatMoney(storeHeader.delivery_fee_halalas)}
                </Text>
              </View>
            )}

            {minOrderHalalas > 0 && (
              <View style={[styles.deliveryInfoItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Ionicons name="cash-outline" size={16} color="#64748B" />
                <Text style={styles.deliveryInfoText}>
                  {lang === "ar" ? "حد أدنى: " : "Min: "}
                  {formatMoney(minOrderHalalas)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* تنبيه الاستلام الذاتي إن وُجد */}
        {isSelfPickupSection && (
          <View style={styles.noticeCard}>
            <Ionicons name="walk" size={20} color="#7C3AED" />
            <Text style={styles.noticeCardText}>
              {lang === "ar"
                ? "الطلب بالاستلام من هذا الفرع متاح قريباً (المرحلة 9)."
                : "Ordering for self-pickup available soon (Phase 9)."}
            </Text>
          </View>
        )}

        {/* تنبيه المتاجر غير المتعاقدة إلكترونياً (المرحلة 9) */}
        {isNonRegisteredOrPaper ? (
          <View style={styles.unregisteredNoticeCard}>
            <Ionicons name="information-circle" size={24} color="#D97706" />
            <Text style={styles.unregisteredNoticeTitle}>
              {lang === "ar" ? "الطلب من هذا المتجر يتاح قريباً" : "Ordering from this store coming soon"}
            </Text>
            <Text style={styles.unregisteredNoticeDesc}>
              {lang === "ar"
                ? "هذا المتجر غير مرتبط بمنيو إلكتروني حالياً، وسيتوفر خيار الطلب والتوصيل قريباً (المرحلة 9)."
                : "This store is not digitally linked yet. Ordering will be enabled in Phase 9."}
            </Text>
          </View>
        ) : (
          <>
            {/* تبويبات أقسام المنيو */}
            {sections.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.sectionsTabsScroll,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
                {sections.map((sec) => {
                  const isActive = activeSectionId === sec.id;
                  const secName = lang === "ar" ? sec.name_ar : sec.name_en;

                  return (
                    <TouchableOpacity
                      key={sec.id}
                      style={[styles.sectionTab, isActive && styles.sectionTabActive]}
                      onPress={() => setActiveSectionId(sec.id)}
                    >
                      <Text style={[styles.sectionTabText, isActive && styles.sectionTabTextActive]}>
                        {secName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* قائمة الأصناف */}
            <View style={styles.menuItemsList}>
              {sections
                .filter((s) => !activeSectionId || s.id === activeSectionId)
                .map((sec) => (
                  <View key={sec.id} style={styles.sectionContainer}>
                    <Text style={[styles.sectionHeaderTitle, { textAlign: isRTL ? "right" : "left" }]}>
                      {lang === "ar" ? sec.name_ar : sec.name_en}
                    </Text>

                    {sec.items.map((item) => {
                      const itemName = lang === "ar" ? item.name_ar : item.name_en;
                      const itemDesc = lang === "ar" ? item.description_ar : item.description_en;
                      const calories = formatCaloriesDisplay({
                        caloriesValue: item.calories_value ?? item.calories,
                        variantsCalories: item.sizes?.map((s) => s.calories_value),
                        isSfdaExempt: Boolean(item.is_sfda_exempt ?? item.is_calories_exempt),
                        lang: lang === "ar" ? "ar" : "en",
                      });

                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.itemCard, { flexDirection: isRTL ? "row-reverse" : "row" }]}
                          activeOpacity={0.7}
                          onPress={() => handleOpenItem(item)}
                        >
                          <View style={{ flex: 1, marginHorizontal: 8, alignItems: isRTL ? "flex-end" : "flex-start" }}>
                            <Text style={styles.itemName}>{itemName}</Text>

                            {itemDesc ? (
                              <Text style={styles.itemDesc} numberOfLines={2}>
                                {itemDesc}
                              </Text>
                            ) : null}

                            {/* صف السعرات وشارات الملح */}
                            <View style={[styles.itemMetaRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                              {calories ? (
                                <View style={[styles.caloriesBadge, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                                  <Ionicons name="flame-outline" size={13} color="#EA580C" />
                                  <Text style={styles.caloriesText}>{calories}</Text>
                                </View>
                              ) : null}

                              {item.is_high_salt && (
                                <View style={styles.saltBadge}>
                                  <Text style={styles.saltBadgeText}>🧂 {lang === "ar" ? "ملح عالي" : "High Salt"}</Text>
                                </View>
                              )}
                            </View>

                            {/* السعر المعتمد للعميل */}
                            <Text style={styles.itemPrice}>
                              {formatMoney(item.customer_price_halalas)}
                            </Text>
                          </View>

                          {/* صورة الصنف وزر الإضافة */}
                          <View style={styles.itemImageContainer}>
                            {item.image_url ? (
                              <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                            ) : (
                              <View style={styles.itemImagePlaceholder}>
                                <Ionicons name="fast-food-outline" size={28} color="#94A3B8" />
                              </View>
                            )}

                            <TouchableOpacity
                              style={styles.addItemBtn}
                              onPress={() => handleOpenItem(item)}
                            >
                              <Ionicons name="add" size={20} color="#2563EB" />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* شريط السلة العائم السفلي (CUS-005, CRT-001) */}
      {itemCount > 0 && (
        <View style={styles.floatingCartBar}>
          {cartQuote && !cartQuote.min_order_reached && (
            <View style={styles.shortfallAlert}>
              <Ionicons name="alert-circle-outline" size={14} color="#D97706" />
              <Text style={styles.shortfallText}>
                {lang === "ar"
                  ? `أضف بـ ${formatMoney(cartQuote.min_order_shortfall_halalas)} للوصول للحد الأدنى للطلب (${formatMoney(cartQuote.min_order_halalas)})`
                  : `Add ${formatMoney(cartQuote.min_order_shortfall_halalas)} to reach min order (${formatMoney(cartQuote.min_order_halalas)})`}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.cartBarBtn, { flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={() => router.push("/cart")}
          >
            <View style={[styles.cartBadge, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="cart" size={18} color="#FFFFFF" />
              <Text style={styles.cartBadgeCount}>{itemCount}</Text>
            </View>

            <Text style={styles.cartBarTitle}>
              {lang === "ar" ? "عرض السلة" : "View Cart"}
            </Text>

            <Text style={styles.cartBarTotal}>
              {cartQuote ? formatMoney(cartQuote.total_halalas) : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* نافذة تخصيص الصنف المودال */}
      <ItemCustomizationModal
        visible={modalVisible}
        item={selectedItemForModal}
        onClose={() => setModalVisible(false)}
        onAddToCart={handleAddToCart}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 12,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#2563EB",
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  navHeader: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    height: 50,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    maxWidth: 220,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  bannerContainer: {
    width: "100%",
    height: 200,
    backgroundColor: "#E2E8F0",
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
  storeHeaderCard: {
    marginTop: -24,
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  logoNameRow: {
    alignItems: "center",
  },
  logoImage: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  logoPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  logoLetter: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2563EB",
  },
  storeNameText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  categoryText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  metaBadgesRow: {
    marginTop: 12,
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeOpen: {
    backgroundColor: "#F0FDF4",
  },
  statusBadgeClosed: {
    backgroundColor: "#FEF2F2",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  deliveryInfoRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "space-around",
  },
  deliveryInfoItem: {
    alignItems: "center",
    gap: 4,
  },
  deliveryInfoText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  noticeCard: {
    margin: 16,
    padding: 12,
    backgroundColor: "#F3E8FF",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noticeCardText: {
    fontSize: 13,
    color: "#7C3AED",
    fontWeight: "600",
    flex: 1,
  },
  unregisteredNoticeCard: {
    margin: 16,
    padding: 24,
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    alignItems: "center",
  },
  unregisteredNoticeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400E",
    marginTop: 8,
  },
  unregisteredNoticeDesc: {
    fontSize: 13,
    color: "#B45309",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  sectionsTabsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  sectionTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionTabActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  sectionTabTextActive: {
    color: "#FFFFFF",
  },
  menuItemsList: {
    paddingHorizontal: 16,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  itemDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 16,
  },
  itemMetaRow: {
    marginTop: 6,
    alignItems: "center",
    gap: 6,
  },
  caloriesBadge: {
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  caloriesText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EA580C",
  },
  saltBadge: {
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  saltBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#DC2626",
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2563EB",
    marginTop: 8,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    position: "relative",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  itemImagePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  addItemBtn: {
    position: "absolute",
    bottom: -6,
    right: -6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  floatingCartBar: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  shortfallAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    gap: 6,
  },
  shortfallText: {
    fontSize: 11,
    color: "#92400E",
    fontWeight: "600",
  },
  cartBarBtn: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  cartBadge: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: "center",
    gap: 4,
  },
  cartBadgeCount: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  cartBarTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  cartBarTotal: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
