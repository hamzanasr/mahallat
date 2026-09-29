import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "../context/LanguageContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useAddress } from "../context/AddressContext";
import { useCart, OutOfStockAction, SuggestedItem } from "../context/CartContext";
import { formatMoney, formatCaloriesDisplay } from "@mahallat/shared";
import { supabase } from "../lib/supabase";
import ItemCustomizationModal, {
  MenuItemData,
  SelectedCustomization,
} from "../components/ItemCustomizationModal";

export default function CartScreen() {
  const router = useRouter();
  const { lang, isRTL } = useLanguage();
  const { user } = useCustomerAuth();
  const { currentAddress, currentDisplayLabel } = useAddress();
  const {
    storeId,
    storeName,
    items,
    itemCount,
    quote,
    loadingQuote,
    storeNote,
    setStoreNote,
    outOfStockAction,
    setOutOfStockAction,
    expiredAlert,
    clearExpiredAlert,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    refreshQuote,
  } = useCart();

  // حالة إرسال الطلب ومفتاح عدم التكرار (Idempotency)
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    () => `idem_${Date.now()}_${Math.random().toString(36).substring(7)}`
  );

  // منع الإضافة المكررة السريعة للأصناف المقترحة (CRT-003)
  const [addingSuggestedId, setAddingSuggestedId] = useState<string | null>(null);

  // مودال تخصيص الصنف المقترح إن كان له أحجام
  const [customizingItem, setCustomizingItem] = useState<MenuItemData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // وسائل الدفع المحفوظة واختيار طريقة الدفع (PAY-001, PAY-023)
  const [paymentMethods, setPaymentMethods] = useState<
    Array<{ id: string; brand: string; last4: string; is_default: boolean }>
  >([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("new_card");

  React.useEffect(() => {
    if (!user) return;
    const loadPaymentMethods = async () => {
      try {
        const { data, error } = await supabase
          .from("customer_payment_methods")
          .select("id, brand, last4, is_default")
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setPaymentMethods(data);
          const def = data.find((d) => d.is_default) || data[0];
          setSelectedMethodId(def.id);
        }
      } catch (e) {
        console.error("خطأ تحميل وسائل الدفع بالسلة:", e);
      }
    };
    loadPaymentMethods();
  }, [user]);

  const handleClearCart = () => {
    Alert.alert(
      lang === "ar" ? "تفريغ السلة" : "Clear Cart",
      lang === "ar" ? "هل أنت متأكد من رغبتك في حذف جميع الأصناف من السلة؟" : "Are you sure you want to remove all items?",
      [
        { text: lang === "ar" ? "إلغاء" : "Cancel", style: "cancel" },
        { text: lang === "ar" ? "تفريغ" : "Clear", style: "destructive", onPress: clearCart },
      ]
    );
  };

  const handleAddSuggested = (sug: SuggestedItem) => {
    if (addingSuggestedId === sug.id) return; // حماية من الضغط المتكرر السريع (CRT-003)

    if (sug.has_sizes && sug.sizes && sug.sizes.length > 0) {
      // فتح صفحة التخصيص لاختيار الحجم الإلزامي (CRT-003)
      setCustomizingItem({
        id: sug.id,
        name_ar: sug.name_ar,
        name_en: sug.name_en,
        description_ar: sug.description_ar,
        description_en: sug.description_en,
        image_url: sug.image_url,
        customer_price_halalas: sug.customer_price_halalas,
        calories_value: sug.calories_value,
        is_sfda_exempt: sug.is_sfda_exempt,
        allergens: sug.allergens,
        is_high_salt: sug.is_high_salt,
        caffeine_mg: sug.caffeine_mg,
        sizes: sug.sizes,
        option_groups: sug.option_groups,
      });
      setModalVisible(true);
      return;
    }

    setAddingSuggestedId(sug.id);
    addItem({
      storeId: storeId || "",
      storeName: storeName || "",
      item: {
        id: sug.id,
        name_ar: sug.name_ar,
        name_en: sug.name_en,
        image_url: sug.image_url,
        customer_price_halalas: sug.customer_price_halalas,
      },
      quantity: 1,
    });

    setTimeout(() => {
      setAddingSuggestedId(null);
    }, 600);
  };

  const handleModalAddToCart = (customization: SelectedCustomization) => {
    addItem({
      storeId: storeId || "",
      storeName: storeName || "",
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
    });
  };

  // التحقق من إمكانية المتابعة للدفع
  const hasErrors = quote?.errors && quote.errors.length > 0;
  const isMinOrderReached = quote?.min_order_reached ?? true;
  const isOpen = quote?.is_open ?? true;
  const canCheckout = !hasErrors && isMinOrderReached && isOpen;

  const handleCheckoutPress = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }

    if (!currentAddress || !currentAddress.pin_confirmed_at) {
      router.push("/address/select");
      return;
    }

    if (!canCheckout || !quote) return;

    try {
      setSubmittingOrder(true);
      const itemsPayload = items.map((it) => ({
        item_id: it.itemId,
        quantity: it.quantity,
        size_id: it.sizeId || null,
        option_ids: it.optionIds || [],
        notes: it.note || null,
      }));

      const { data: res, error: rpcErr } = await supabase.rpc("create_customer_order", {
        p_branch_id: quote.branch_id,
        p_delivery_type: "delivery",
        p_address_id: currentAddress.id,
        p_items: itemsPayload as any,
        p_expected_total_halalas: quote.total_halalas,
        p_customer_notes: storeNote.trim() || undefined,
        p_out_of_stock_action:
          outOfStockAction === "remove"
            ? "refund"
            : outOfStockAction === "call"
            ? "contact"
            : "cancel",
        p_idempotency_key: idempotencyKey,
        p_tip_halalas: 0,
      });

      if (rpcErr) {
        Alert.alert(
          lang === "ar" ? "تعذر إنشاء الطلب" : "Cannot Create Order",
          rpcErr.message
        );
        return;
      }

      const result = res as any;
      if (!result.success) {
        if (result.error_code === "PRICE_MISMATCH") {
          Alert.alert(
            lang === "ar" ? "تغيرت الأسعار أو الرسوم" : "Price or Fee Changed",
            lang === "ar"
              ? `لقد تغيّرت الأسعار أو الرسوم من الخادم.\nالإجمالي الجديد: ${formatMoney(result.new_total_halalas)}.\nتم تحديث السلة تلقائياً.`
              : `Prices or fees have updated.\nNew total: ${formatMoney(result.new_total_halalas)}. Cart has been updated.`
          );
          await refreshQuote();
          return;
        }

        Alert.alert(
          lang === "ar" ? "تنبيه" : "Notice",
          result.message || "حدث خطأ أثناء إنشاء الطلب"
        );
        return;
      }

      // حجز وتفويض المبلغ عبر ميسر (PAY-001, ORD-002)
      let brand = "mada";
      let last4 = "0001";
      let pMethodId: string | null = null;

      if (selectedMethodId !== "new_card" && selectedMethodId !== "applepay") {
        const found = paymentMethods.find((m) => m.id === selectedMethodId);
        if (found) {
          brand = found.brand;
          last4 = found.last4;
          pMethodId = found.id;
        }
      } else if (selectedMethodId === "applepay") {
        brand = "applepay";
        last4 = "8888";
      }

      const mockGatewayRef = `pay_moyasar_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const { error: authErr } = await supabase.rpc("record_order_payment_authorization", {
        p_order_id: result.order_id,
        p_gateway_reference: mockGatewayRef,
        p_amount_halalas: quote.total_halalas,
        p_brand: brand,
        p_last4: last4,
        p_payment_method_id: pMethodId || undefined,
        p_metadata: { source: selectedMethodId, idempotency_key: idempotencyKey } as any,
      });

      if (authErr) {
        Alert.alert(
          lang === "ar" ? "تعذر تفويض الدفع" : "Payment Authorization Failed",
          authErr.message
        );
        return;
      }

      // نجاح إنشاء الطلب وتفويض المبلغ! تفريغ السلة والانتقال لصفحة متابعة الطلب
      clearCart();
      router.replace({
        pathname: "/order/[id]",
        params: { id: result.order_id },
      } as any);
    } catch (err: any) {
      Alert.alert(
        lang === "ar" ? "خطأ غير متوقع" : "Unexpected Error",
        err?.message || "حدث خطأ أثناء معالجة الطلب"
      );
    } finally {
      setSubmittingOrder(false);
    }
  };

  // حالة السلة الفارغة
  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{lang === "ar" ? "السلة" : "Cart"}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>
            {lang === "ar" ? "سلتك فارغة" : "Your cart is empty"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {lang === "ar"
              ? "تصفح المتاجر المفضلة وأضف أشهى الأطباق والمنتجات"
              : "Explore stores and add delicious items to your cart"}
          </Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push("/(tabs)")}>
            <Text style={styles.exploreBtnText}>
              {lang === "ar" ? "تصفح المتاجر" : "Explore Stores"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* الشريط العلوي */}
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={styles.headerTitle}>{lang === "ar" ? "السلة" : "Cart"}</Text>
          {storeName ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {storeName}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity onPress={handleClearCart} style={styles.clearBtn}>
          <Ionicons name="trash-outline" size={20} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* تنبيه انتهاء صلاحية السلة السابقة إن وُجد (CRT-004) */}
        {expiredAlert && (
          <View style={[styles.alertBanner, styles.alertExpired, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Ionicons name="time" size={18} color="#D97706" />
            <Text style={styles.alertExpiredText}>{expiredAlert}</Text>
            <TouchableOpacity onPress={clearExpiredAlert}>
              <Ionicons name="close" size={16} color="#D97706" />
            </TouchableOpacity>
          </View>
        )}

        {/* تنبيه تباعد موقع الجهاز عن العنوان المختار > 250 متر (CUS-002) */}
        {quote?.is_device_location_divergent && (
          <View style={[styles.alertBanner, styles.alertDivergent, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <View style={{ flex: 1, marginHorizontal: 8, alignItems: isRTL ? "flex-end" : "flex-start" }}>
              <Text style={styles.alertDivergentTitle}>
                {lang === "ar" ? "موقعك الحالي بعيد عن عنوان التوصيل" : "Your current location is far from delivery address"}
              </Text>
              <Text style={styles.alertDivergentSub}>
                {lang === "ar" ? `العنوان المختار: ${currentDisplayLabel}` : `Selected: ${currentDisplayLabel}`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.changeAddressPill}
              onPress={() => router.push("/address/select")}
            >
              <Text style={styles.changeAddressPillText}>
                {lang === "ar" ? "تغيير العنوان" : "Change"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* تنبيه أخطاء السلة أو الأصناف غير المتاحة (CRT-001) */}
        {hasErrors && (
          <View style={styles.errorsContainer}>
            {quote!.errors.map((err, idx) => (
              <View
                key={idx}
                style={[styles.errorRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
              >
                <Ionicons name="warning" size={16} color="#DC2626" />
                <Text style={styles.errorRowText}>
                  {err.item_name_ar ? `«${err.item_name_ar}»: ` : ""}
                  {err.message}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* قائمة الأصناف في السلة */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign: isRTL ? "right" : "left" }]}>
            {lang === "ar" ? `الأصناف (${itemCount})` : `Items (${itemCount})`}
          </Text>

          {items.map((item) => {
            const hasItemError = quote?.errors?.some((e) => e.item_id === item.itemId);

            return (
              <View
                key={item.lineId}
                style={[
                  styles.itemRow,
                  hasItemError && styles.itemRowError,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.itemThumb} />
                ) : (
                  <View style={styles.itemThumbPlaceholder}>
                    <Ionicons name="fast-food-outline" size={20} color="#94A3B8" />
                  </View>
                )}

                <View style={{ flex: 1, marginHorizontal: 10, alignItems: isRTL ? "flex-end" : "flex-start" }}>
                  <Text style={styles.itemNameText}>
                    {lang === "ar" ? item.nameAr : item.nameEn}
                  </Text>

                  {item.sizeNameAr ? (
                    <Text style={styles.itemDetailText}>
                      {lang === "ar" ? `الحجم: ${item.sizeNameAr}` : `Size: ${item.sizeNameEn}`}
                    </Text>
                  ) : null}

                  {item.optionsSummaryAr ? (
                    <Text style={styles.itemDetailText}>{item.optionsSummaryAr}</Text>
                  ) : null}

                  {item.note ? (
                    <Text style={styles.itemNoteText}>📝 {item.note}</Text>
                  ) : null}

                  <Text style={styles.itemPriceText}>
                    {formatMoney(item.unitPriceHalalas * item.quantity)}
                  </Text>
                </View>

                {/* أزرار تعديل الكمية وحذف الصنف */}
                <View style={[styles.qtyRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <TouchableOpacity
                    style={styles.qtyActionBtn}
                    onPress={() => updateQuantity(item.lineId, item.quantity - 1)}
                  >
                    <Ionicons
                      name={item.quantity === 1 ? "trash-outline" : "remove"}
                      size={16}
                      color={item.quantity === 1 ? "#DC2626" : "#0F172A"}
                    />
                  </TouchableOpacity>

                  <Text style={styles.qtyValueText}>{item.quantity}</Text>

                  <TouchableOpacity
                    style={styles.qtyActionBtn}
                    onPress={() => updateQuantity(item.lineId, item.quantity + 1)}
                  >
                    <Ionicons name="add" size={16} color="#0F172A" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* خانة ملاحظات المتجر مع تنبيه عدم الإلزام الإلزامي (CRT-001) */}
        <View style={styles.card}>
          <View style={[styles.noteHeaderRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Text style={styles.cardTitle}>
              {lang === "ar" ? "ملاحظة للمتجر" : "Note for Store"}
            </Text>
            {/* التنبيه بجانب الخانة مباشرة (شرط CRT-001 حرفياً) */}
            <View style={[styles.nonBindingNotice, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="information-circle-outline" size={13} color="#64748B" />
              <Text style={styles.nonBindingNoticeText}>
                {lang === "ar" ? "الملاحظات غير ملزمة للمتجر" : "Notes are not binding for the store"}
              </Text>
            </View>
          </View>

          <TextInput
            style={[styles.storeNoteInput, { textAlign: isRTL ? "right" : "left" }]}
            placeholder={
              lang === "ar"
                ? "مثال: يرجى وضع الصوص بالخارج، عدم الرن على الجرس..."
                : "e.g., Sauce on side, please do not ring doorbell..."
            }
            placeholderTextColor="#94A3B8"
            value={storeNote}
            onChangeText={setStoreNote}
            maxLength={200}
            multiline
          />
        </View>

        {/* خيارات نفاد الصنف المسبقة (CRT-001) */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign: isRTL ? "right" : "left" }]}>
            {lang === "ar" ? "إذا نفد صنف من طلبك:" : "If an item is out of stock:"}
          </Text>

          <View style={styles.outOfStockOptions}>
            {[
              { key: "remove" as OutOfStockAction, textAr: "احذفه وأرجع لي ثمنه (افتراضي)", textEn: "Remove & refund (Default)" },
              { key: "call" as OutOfStockAction, textAr: "اتصل بي لتحديد البديل", textEn: "Call me for substitute" },
              { key: "cancel" as OutOfStockAction, textAr: "ألغِ الطلب كاملاً", textEn: "Cancel entire order" },
            ].map((opt) => {
              const isSelected = outOfStockAction === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.radioOption,
                    isSelected && styles.radioOptionSelected,
                    { flexDirection: isRTL ? "row-reverse" : "row" },
                  ]}
                  onPress={() => setOutOfStockAction(opt.key)}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.radioOptionText, isSelected && styles.radioOptionTextActive]}>
                    {lang === "ar" ? opt.textAr : opt.textEn}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* أصناف مقترحة من نفس المتجر (CRT-003) */}
        {quote?.suggested_items && quote.suggested_items.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar" ? "أصناف مقترحة لك" : "Suggested for you"}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.suggestedScroll, { flexDirection: isRTL ? "row-reverse" : "row" }]}
            >
              {quote.suggested_items.map((sug) => {
                const sugName = lang === "ar" ? sug.name_ar : sug.name_en;
                const sugCalories = formatCaloriesDisplay({
                  caloriesValue: sug.calories_value,
                  variantsCalories: sug.sizes?.map((s) => s.calories_value),
                  isSfdaExempt: sug.is_sfda_exempt,
                  lang: lang === "ar" ? "ar" : "en",
                });
                const isAdding = addingSuggestedId === sug.id;

                return (
                  <View key={sug.id} style={styles.suggestedCard}>
                    {sug.image_url ? (
                      <Image source={{ uri: sug.image_url }} style={styles.suggestedImage} />
                    ) : (
                      <View style={styles.suggestedPlaceholder}>
                        <Ionicons name="fast-food-outline" size={24} color="#94A3B8" />
                      </View>
                    )}

                    <Text style={styles.suggestedName} numberOfLines={1}>
                      {sugName}
                    </Text>

                    {sugCalories ? (
                      <Text style={styles.suggestedCalories}>{sugCalories}</Text>
                    ) : null}

                    <Text style={styles.suggestedPrice}>
                      {formatMoney(sug.customer_price_halalas)}
                    </Text>

                    <TouchableOpacity
                      style={[styles.addSuggestedBtn, isAdding && styles.addSuggestedBtnDisabled]}
                      onPress={() => handleAddSuggested(sug)}
                      disabled={isAdding}
                    >
                      {isAdding ? (
                        <ActivityIndicator size="small" color="#2563EB" />
                      ) : (
                        <Text style={styles.addSuggestedBtnText}>
                          {sug.has_sizes
                            ? lang === "ar" ? "اختر الحجم" : "Choose"
                            : lang === "ar" ? "+ أضف" : "+ Add"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* اختيار وسيلة الدفع (PAY-001, PAY-023) */}
        <View style={styles.card}>
          <View style={[styles.cardHeaderWithLink, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Text style={styles.cardTitle}>
              {lang === "ar" ? "طريقة الدفع (ميسر)" : "Payment Method (Moyasar)"}
            </Text>
            <TouchableOpacity onPress={() => router.push("/cards")}>
              <Text style={styles.manageCardsLink}>
                {lang === "ar" ? "إدارة البطاقات" : "Manage Cards"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.paymentNoticeBox, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Ionicons name="shield-checkmark" size={16} color="#059669" />
            <Text style={[styles.paymentNoticeText, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar"
                ? "يتم حجز المبلغ مؤقتاً على بطاقتك ولا يُحصَّل إلا بعد استلام الطلب بالرمز السري. متاح 60 ثانية للتراجع المجاني."
                : "Funds are temporarily authorized on your card and only captured upon delivery. 60s free cancellation."}
            </Text>
          </View>

          {/* البطاقات المحفوظة إن وُجدت */}
          {paymentMethods.map((m) => {
            const isSelected = selectedMethodId === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.paymentOptionItem,
                  isSelected && styles.paymentOptionItemActive,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
                onPress={() => setSelectedMethodId(m.id)}
              >
                <Ionicons
                  name={m.brand === "applepay" ? "logo-apple" : "card"}
                  size={20}
                  color={isSelected ? "#2563EB" : "#64748B"}
                />
                <Text style={styles.paymentOptionLabel}>
                  {m.brand.toUpperCase()} •••• {m.last4}{" "}
                  {m.is_default ? (lang === "ar" ? "(افتراضية)" : "(Default)") : ""}
                </Text>
                <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* خيار بطاقة تجريبية جديدة */}
          <TouchableOpacity
            style={[
              styles.paymentOptionItem,
              selectedMethodId === "new_card" && styles.paymentOptionItemActive,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
            onPress={() => setSelectedMethodId("new_card")}
          >
            <Ionicons
              name="card-outline"
              size={20}
              color={selectedMethodId === "new_card" ? "#2563EB" : "#64748B"}
            />
            <Text style={styles.paymentOptionLabel}>
              {lang === "ar" ? "بطاقة جديدة (مدى / فيزا)" : "New Card (mada / Visa)"}
            </Text>
            <View style={[styles.radioCircle, selectedMethodId === "new_card" && styles.radioCircleActive]}>
              {selectedMethodId === "new_card" && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>

          {/* خيار Apple Pay */}
          <TouchableOpacity
            style={[
              styles.paymentOptionItem,
              selectedMethodId === "applepay" && styles.paymentOptionItemActive,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
            onPress={() => setSelectedMethodId("applepay")}
          >
            <Ionicons
              name="logo-apple"
              size={20}
              color={selectedMethodId === "applepay" ? "#000000" : "#64748B"}
            />
            <Text style={styles.paymentOptionLabel}>Apple Pay</Text>
            <View style={[styles.radioCircle, selectedMethodId === "applepay" && styles.radioCircleActive]}>
              {selectedMethodId === "applepay" && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* ملخص الدفع بالكامل من الخادم (CRT-005) */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign: isRTL ? "right" : "left" }]}>
            {lang === "ar" ? "ملخص الدفع" : "Payment Summary"}
          </Text>

          {loadingQuote ? (
            <View style={styles.quoteLoader}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.quoteLoaderText}>
                {lang === "ar" ? "جاري احتساب المجموع بالهللة..." : "Calculating total..."}
              </Text>
            </View>
          ) : quote ? (
            <View style={styles.summaryTable}>
              {/* المنتجات */}
              <View style={[styles.summaryRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={styles.summaryLabel}>
                  {lang === "ar" ? "المنتجات" : "Products"}
                </Text>
                <Text style={styles.summaryValue}>
                  {formatMoney(quote.products_total_halalas)}
                </Text>
              </View>

              {/* رسوم التوصيل */}
              <View style={[styles.summaryRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={styles.summaryLabel}>
                  {lang === "ar" ? "رسوم التوصيل" : "Delivery Fee"}
                </Text>
                <Text style={styles.summaryValue}>
                  {quote.delivery_fee_halalas === 0
                    ? lang === "ar" ? "مجاناً" : "Free"
                    : formatMoney(quote.delivery_fee_halalas)}
                </Text>
              </View>

              {/* رسوم الخدمة (إن وُجدت) */}
              {quote.service_fee_halalas > 0 && (
                <View style={[styles.summaryRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Text style={styles.summaryLabel}>
                    {lang === "ar" ? "رسوم الخدمة" : "Service Fee"}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {formatMoney(quote.service_fee_halalas)}
                  </Text>
                </View>
              )}

              {/* الخصم (إن وُجد) */}
              {quote.discount_halalas > 0 && (
                <View style={[styles.summaryRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Text style={styles.discountLabel}>
                    {lang === "ar" ? "الخصم" : "Discount"}
                  </Text>
                  <Text style={styles.discountValue}>
                    -{formatMoney(quote.discount_halalas)}
                  </Text>
                </View>
              )}

              {/* الإكرامية (إن وُجدت) */}
              {quote.tip_halalas > 0 && (
                <View style={[styles.summaryRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Text style={styles.summaryLabel}>
                    {lang === "ar" ? "إكرامية التوصيل" : "Driver Tip"}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {formatMoney(quote.tip_halalas)}
                  </Text>
                </View>
              )}

              {/* من المحفظة (إن وُجدت) */}
              {quote.wallet_halalas > 0 && (
                <View style={[styles.summaryRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Text style={styles.discountLabel}>
                    {lang === "ar" ? "من المحفظة" : "Wallet Credit"}
                  </Text>
                  <Text style={styles.discountValue}>
                    -{formatMoney(quote.wallet_halalas)}
                  </Text>
                </View>
              )}

              <View style={styles.summaryDivider} />

              {/* المطلوب: القاعدة الذهبية CRT-005 */}
              <View style={[styles.summaryRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={styles.totalLabel}>
                  {lang === "ar" ? "المطلوب" : "Total Due"}
                </Text>
                <Text style={styles.totalValue}>
                  {formatMoney(quote.total_halalas)}
                </Text>
              </View>

              {/* توضيح شمول الضريبة (REG-002) */}
              <Text style={[styles.vatNote, { textAlign: isRTL ? "right" : "left" }]}>
                {lang === "ar" ? "الأسعار شاملة ضريبة القيمة المضافة 15%" : "All prices include 15% VAT"}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* الشريط السفلي وزر الدفع */}
      <View style={styles.footer}>
        {/* تنبيه الحد الأدنى للطلب إن لم يكتمل */}
        {!isMinOrderReached && quote && (
          <View style={[styles.footerAlert, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Ionicons name="alert-circle" size={16} color="#D97706" />
            <Text style={styles.footerAlertText}>
              {lang === "ar"
                ? `أضف بـ ${formatMoney(quote.min_order_shortfall_halalas)} للوصول للحد الأدنى (${formatMoney(quote.min_order_halalas)})`
                : `Add ${formatMoney(quote.min_order_shortfall_halalas)} to reach min order (${formatMoney(quote.min_order_halalas)})`}
            </Text>
          </View>
        )}

        {/* تنبيه المتجر مغلق إن كان مغلقاً */}
        {!isOpen && quote && (
          <View style={[styles.footerAlertRed, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Ionicons name="close-circle" size={16} color="#DC2626" />
            <Text style={styles.footerAlertRedText}>
              {lang === "ar"
                ? quote.next_open_at
                  ? `المتجر مغلق حالياً · يفتح ${new Date(quote.next_open_at).toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" })}`
                  : "المتجر مغلق حالياً"
                : "Store is currently closed"}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.checkoutBtn, (!canCheckout || submittingOrder) && styles.checkoutBtnDisabled]}
          onPress={handleCheckoutPress}
          disabled={(!canCheckout && Boolean(user)) || submittingOrder}
        >
          {submittingOrder ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.checkoutBtnText}>
              {!user
                ? lang === "ar" ? "تسجيل الدخول للمتابعة" : "Login to Checkout"
                : canCheckout
                ? lang === "ar"
                  ? `إتمام الطلب · ${formatMoney(quote?.total_halalas || 0)}`
                  : `Checkout · ${formatMoney(quote?.total_halalas || 0)}`
                : lang === "ar"
                ? "الدفع غير متاح حالياً"
                : "Checkout Unavailable"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* نافذة تخصيص الصنف المقترح إن طُلب */}
      <ItemCustomizationModal
        visible={modalVisible}
        item={customizingItem}
        onClose={() => setModalVisible(false)}
        onAddToCart={handleModalAddToCart}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    maxWidth: 200,
  },
  clearBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  exploreBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  alertBanner: {
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  alertExpired: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  alertExpiredText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
    flex: 1,
  },
  alertDivergent: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  alertDivergentTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991B1B",
  },
  alertDivergentSub: {
    fontSize: 11,
    color: "#B91C1C",
    marginTop: 2,
  },
  changeAddressPill: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changeAddressPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  errorsContainer: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    gap: 6,
  },
  errorRow: {
    alignItems: "center",
    gap: 6,
  },
  errorRowText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  itemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  itemRowError: {
    backgroundColor: "#FFF1F2",
    borderRadius: 8,
    padding: 8,
  },
  itemThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  itemThumbPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  itemDetailText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  itemNoteText: {
    fontSize: 11,
    color: "#D97706",
    marginTop: 2,
  },
  itemPriceText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
    marginTop: 4,
  },
  qtyRow: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  qtyActionBtn: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyValueText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    paddingHorizontal: 6,
  },
  noteHeaderRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nonBindingNotice: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  nonBindingNoticeText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
  storeNoteInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 50,
  },
  outOfStockOptions: {
    gap: 8,
  },
  radioOption: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  radioOptionSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleActive: {
    borderColor: "#2563EB",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  radioOptionText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
  },
  radioOptionTextActive: {
    color: "#1E40AF",
    fontWeight: "700",
  },
  suggestedScroll: {
    gap: 12,
  },
  suggestedCard: {
    width: 130,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  suggestedImage: {
    width: "100%",
    height: 70,
    borderRadius: 8,
  },
  suggestedPlaceholder: {
    width: "100%",
    height: 70,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  suggestedName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 6,
    textAlign: "center",
  },
  suggestedCalories: {
    fontSize: 10,
    color: "#EA580C",
    marginTop: 2,
  },
  suggestedPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
    marginTop: 4,
  },
  addSuggestedBtn: {
    marginTop: 6,
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2563EB",
    alignItems: "center",
  },
  addSuggestedBtnDisabled: {
    opacity: 0.6,
  },
  addSuggestedBtnText: {
    color: "#2563EB",
    fontSize: 11,
    fontWeight: "700",
  },
  quoteLoader: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
  },
  quoteLoaderText: {
    fontSize: 12,
    color: "#64748B",
  },
  summaryTable: {
    gap: 8,
  },
  summaryRow: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#64748B",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  discountLabel: {
    fontSize: 13,
    color: "#16A34A",
  },
  discountValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16A34A",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  totalValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#2563EB",
  },
  vatNote: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
  },
  footer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  footerAlert: {
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 6,
  },
  footerAlertText: {
    fontSize: 11,
    color: "#B45309",
    fontWeight: "600",
    flex: 1,
  },
  footerAlertRed: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 6,
  },
  footerAlertRedText: {
    fontSize: 11,
    color: "#DC2626",
    fontWeight: "600",
    flex: 1,
  },
  checkoutBtn: {
    backgroundColor: "#2563EB",
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  checkoutBtnDisabled: {
    backgroundColor: "#94A3B8",
  },
  checkoutBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  cardHeaderWithLink: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  manageCardsLink: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600",
  },
  paymentNoticeBox: {
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    marginBottom: 12,
    alignItems: "center",
    gap: 6,
  },
  paymentNoticeText: {
    flex: 1,
    fontSize: 11,
    color: "#166534",
    lineHeight: 16,
  },
  paymentOptionItem: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  paymentOptionItemActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  paymentOptionLabel: {
    flex: 1,
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "600",
  },
});

