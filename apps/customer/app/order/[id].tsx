import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLanguage } from "../../context/LanguageContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { supabase } from "../../lib/supabase";
import { formatMoney } from "@mahallat/shared";

interface StatusHistoryItem {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by_role: string;
  reason: string | null;
  created_at: string;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  delivery_type: string;
  total_halalas: number;
  items_total_halalas: number;
  delivery_fee_halalas: number;
  service_fee_halalas: number;
  discount_halalas: number;
  tip_halalas: number;
  customer_notes: string | null;
  out_of_stock_action: string;
  pickup_code: string | null;
  delivery_code: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by_role: string | null;
  order_snapshot: any;
  delivery_address_snapshot: any;
  cooling_off_expires_at: string | null;
  payment_status: string;
  payment_brand: string | null;
  payment_last4: string | null;
  authorized_at: string | null;
  free_cancellation_until: string | null;
  captured_at: string | null;
  voided_at: string | null;
  estimated_prep_time_minutes: number;
  estimated_delivery_time_minutes: number;
  created_at: string;
}

export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang, isRTL } = useLanguage();
  const { user } = useCustomerAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // عداد الـ 60 ثانية للتراجع المجاني (ORD-002)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    if (!order?.free_cancellation_until || order.status === "cancelled" || order.payment_status === "voided") {
      setSecondsRemaining(0);
      return;
    }
    const target = new Date(order.free_cancellation_until).getTime();
    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((target - now) / 1000));
      setSecondsRemaining(diff);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [order?.free_cancellation_until, order?.status, order?.payment_status]);

  // حالة مودال الإلغاء
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchOrderData = useCallback(async () => {
    if (!id) return;
    try {
      const { data: orderData, error: orderErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

      if (orderErr) {
        console.error("خطأ جلب بيانات الطلب:", orderErr.message);
        return;
      }
      setOrder(orderData as unknown as OrderDetail);

      const { data: histData, error: histErr } = await supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: true });

      if (!histErr && histData) {
        setHistory(histData as unknown as StatusHistoryItem[]);
      }
    } catch (err) {
      console.error("خطأ عام في تحميل الطلب:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrderData();

    // الاستماع للتحديثات الحية Realtime
    if (!id) return;
    const channel = supabase
      .channel(`order-channel-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` },
        () => {
          fetchOrderData();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_status_history", filter: `order_id=eq.${id}` },
        () => {
          fetchOrderData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchOrderData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrderData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_payment":
        return {
          title: lang === "ar" ? "بانتظار الدفع" : "Pending Payment",
          desc: lang === "ar" ? "جاري تحويلك لبوابة الدفع لحجز المبلغ" : "Waiting for payment authorization",
          bg: "#EFF6FF",
          color: "#2563EB",
          icon: "card-outline",
        };
      case "cooling_off":
        return {
          title: lang === "ar" ? "مهلة التراجع (60 ثانية)" : "Cooling-off (60s)",
          desc: lang === "ar" ? "يمكنك التراجع وإلغاء الطلب بلا تكلفة" : "You can cancel for free within 60s",
          bg: "#ECFDF5",
          color: "#059669",
          icon: "timer-outline",
        };
      case "pending_driver":
        return {
          title: lang === "ar" ? "بانتظار مندوب" : "Searching for Driver",
          desc: lang === "ar" ? "يتم البحث عن أقرب مندوب متاح لتوصيل طلبك" : "Assigning nearby driver",
          bg: "#FEF3C7",
          color: "#D97706",
          icon: "bicycle-outline",
        };
      case "preparing":
        return {
          title: lang === "ar" ? "جاري التجهيز" : "Preparing Order",
          desc: lang === "ar" ? "المتجر يجهز طلبك الآن بعناية" : "Store is preparing your items",
          bg: "#FFF7ED",
          color: "#EA580C",
          icon: "restaurant-outline",
        };
      case "ready_for_pickup":
        return {
          title: lang === "ar" ? "جاهز للاستلام" : "Ready for Pickup",
          desc: lang === "ar" ? "الطلب جاهز وبانتظار استلام المندوب" : "Ready for driver pickup",
          bg: "#F0FDF4",
          color: "#16A34A",
          icon: "cube-outline",
        };
      case "picked_up":
      case "in_transit":
        return {
          title: lang === "ar" ? "المندوب في الطريق إليك" : "In Transit",
          desc: lang === "ar" ? "المندوب استلم الطلب وهو في الطريق إلى موقعك" : "Driver is heading to your location",
          bg: "#EFF6FF",
          color: "#1D4ED8",
          icon: "navigate-circle-outline",
        };
      case "arrived":
        return {
          title: lang === "ar" ? "وصل المندوب عند الباب" : "Driver Arrived",
          desc: lang === "ar" ? "المندوب بانتظارك عند العنوان، يرجى الاستلام بالكود" : "Driver arrived at your location",
          bg: "#FAF5FF",
          color: "#7E22CE",
          icon: "location-outline",
        };
      case "delivered":
      case "completed":
        return {
          title: lang === "ar" ? "تم التسليم بنجاح" : "Delivered",
          desc: lang === "ar" ? "شكراً لطلبك، بالعافية عليك!" : "Delivered successfully",
          bg: "#F0FDF4",
          color: "#15803D",
          icon: "checkmark-done-circle-outline",
        };
      case "cancelled":
        return {
          title: lang === "ar" ? "تم إلغاء الطلب" : "Cancelled",
          desc: order?.cancellation_reason || (lang === "ar" ? "تم إلغاء هذا الطلب" : "This order was cancelled"),
          bg: "#FEF2F2",
          color: "#DC2626",
          icon: "close-circle-outline",
        };
      default:
        return {
          title: status,
          desc: "",
          bg: "#F1F5F9",
          color: "#475569",
          icon: "information-circle-outline",
        };
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      Alert.alert(
        lang === "ar" ? "سبب الإلغاء إلزامي" : "Reason Required",
        lang === "ar" ? "يرجى كتابة سبب الإلغاء للمتابعة (ORD-004)" : "Please enter a cancellation reason (ORD-004)"
      );
      return;
    }

    try {
      setCancelling(true);
      const { data, error } = await supabase.rpc("cancel_customer_order", {
        p_order_id: id,
        p_reason: cancelReason.trim(),
      });

      if (error) {
        Alert.alert(lang === "ar" ? "تعذر الإلغاء" : "Cannot Cancel", error.message);
        return;
      }

      setCancelModalVisible(false);
      setCancelReason("");
      Alert.alert(
        lang === "ar" ? "تم الإلغاء" : "Cancelled",
        lang === "ar" ? "تم إلغاء الطلب بنجاح وفك الحجز." : "Order has been cancelled successfully."
      );
      fetchOrderData();
    } catch (err: any) {
      Alert.alert(lang === "ar" ? "خطأ" : "Error", err?.message || "حدث خطأ أثناء الإلغاء");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            {lang === "ar" ? "جاري تحميل تفاصيل الطلب..." : "Loading order details..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centerContainer}>
          <Ionicons name="receipt-outline" size={56} color="#94A3B8" />
          <Text style={styles.notFoundTitle}>
            {lang === "ar" ? "الطلب غير موجود" : "Order Not Found"}
          </Text>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace("/(tabs)/orders")}>
            <Text style={styles.backHomeText}>
              {lang === "ar" ? "العودة لقائمة الطلبات" : "Back to Orders"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const badge = getStatusBadge(order.status);
  const snapshot = order.order_snapshot || {};
  const storeInfo = snapshot.store || {};
  const branchInfo = snapshot.branch || {};
  const itemsList = snapshot.items || [];
  const addressSnapshot = order.delivery_address_snapshot || {};

  // هل يقدر العميل يلغي الطلب بنفسه؟ (ORD-004: فقط قبل جاري التجهيز)
  const isCancellableByCustomer = [
    "pending_payment",
    "created",
    "scheduled",
    "accepted_by_driver",
    "driver_heading_to_store",
    "cooling_off",
    "pending_driver",
  ].includes(order.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* الشريط العلوي */}
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.orderNumberText}>{order.order_number}</Text>
          <Text style={styles.orderDateText}>
            {new Date(order.created_at).toLocaleDateString("ar-SA", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* شريط مهلة التراجع المجاني (ORD-002: 60 ثانية) */}
        {secondsRemaining > 0 && order.status !== "cancelled" && (
          <View style={styles.coolingOffCard}>
            <View style={[styles.coolingOffHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={styles.timerBadge}>
                <Ionicons name="timer-outline" size={18} color="#D97706" />
                <Text style={styles.timerBadgeText}>
                  {secondsRemaining} {lang === "ar" ? "ثانية متبقية" : "s remaining"}
                </Text>
              </View>
              <Text style={styles.coolingOffTitle}>
                {lang === "ar" ? "مهلة التراجع المجاني" : "Free Cancellation"}
              </Text>
            </View>
            <Text style={[styles.coolingOffDesc, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar"
                ? "المبلغ محجوز فقط على بطاقتك. يمكنك إلغاء الطلب الآن بضغطة واحدة وسيتم فك الحجز فوراً دون أي رسوم."
                : "Funds are only on hold. You can cancel now with one tap to void authorization with zero fees."}
            </Text>
            <TouchableOpacity
              style={styles.quickCancelBtn}
              onPress={() => {
                setCancelReason(lang === "ar" ? "تراجع خلال مهلة الـ 60 ثانية" : "Cancelled within 60s window");
                setCancelModalVisible(true);
              }}
            >
              <Text style={styles.quickCancelBtnText}>
                {lang === "ar" ? "تراجع عن الطلب (مجاناً)" : "Cancel Order (Free)"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* بطاقة الحالة الحالية */}
        <View style={[styles.statusCard, { backgroundColor: badge.bg, borderColor: badge.color + "40" }]}>
          <View style={[styles.statusHeaderRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.statusIconCircle, { backgroundColor: badge.color + "20" }]}>
              <Ionicons name={badge.icon as any} size={24} color={badge.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: badge.color, textAlign: isRTL ? "right" : "left" }]}>
                {badge.title}
              </Text>
              {badge.desc ? (
                <Text style={[styles.statusDesc, { textAlign: isRTL ? "right" : "left" }]}>
                  {badge.desc}
                </Text>
              ) : null}
            </View>
          </View>

          {/* كود التسليم للعميل (يظهر بشكل بارز عندما يكون في الطريق أو وصل المندوب) */}
          {order.delivery_code && ["in_transit", "arrived", "picked_up"].includes(order.status) && (
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>
                {lang === "ar" ? "كود التسليم للمندوب عند الوصول (ORD-005):" : "Delivery code for driver:"}
              </Text>
              <Text style={styles.codeDigits}>{order.delivery_code}</Text>
            </View>
          )}
        </View>

        {/* تفاصيل الدفع والبطاقة (PAY-001, PAY-023) */}
        <View style={styles.card}>
          <View style={[styles.cardHeaderRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Ionicons name="card-outline" size={18} color="#2563EB" />
            <Text style={styles.cardSectionTitle}>
              {lang === "ar" ? "بيانات الدفع الإلكتروني (ميسر)" : "Payment Information (Moyasar)"}
            </Text>
          </View>
          <View style={[styles.paymentRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Text style={styles.paymentRowLabel}>
              {lang === "ar" ? "وسيلة الدفع:" : "Payment Method:"}
            </Text>
            <Text style={styles.paymentRowValue}>
              {order.payment_brand ? order.payment_brand.toUpperCase() : "مدى mada"} •••• {order.payment_last4 || "0001"}
            </Text>
          </View>
          <View style={[styles.paymentRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Text style={styles.paymentRowLabel}>
              {lang === "ar" ? "حالة الدفع:" : "Payment Status:"}
            </Text>
            <View
              style={[
                styles.paymentStatusBadge,
                order.payment_status === "authorized" && { backgroundColor: "#FEF3C7" },
                order.payment_status === "captured" && { backgroundColor: "#DCFCE7" },
                order.payment_status === "voided" && { backgroundColor: "#F1F5F9" },
              ]}
            >
              <Text
                style={[
                  styles.paymentStatusBadgeText,
                  order.payment_status === "authorized" && { color: "#D97706" },
                  order.payment_status === "captured" && { color: "#16A34A" },
                  order.payment_status === "voided" && { color: "#64748B" },
                ]}
              >
                {order.payment_status === "authorized"
                  ? lang === "ar" ? "محجوز بنكياً (لم يُحصَّل بعد)" : "Authorized (Hold)"
                  : order.payment_status === "captured"
                  ? lang === "ar" ? "تم التحصيل" : "Captured"
                  : order.payment_status === "voided"
                  ? lang === "ar" ? "تم فك الحجز بالكامل" : "Voided / Released"
                  : order.payment_status}
              </Text>
            </View>
          </View>
          <Text style={[styles.paymentSubtext, { textAlign: isRTL ? "right" : "left" }]}>
            {order.payment_status === "authorized"
              ? lang === "ar"
                ? "المبلغ محجوز على بطاقتك فقط، ولن يُخصم نهائياً إلا بعد استلام الطلب بالرمز السري."
                : "Funds are temporarily on hold; only captured upon PIN verification."
              : order.payment_status === "voided"
              ? lang === "ar"
                ? "تم فك الحجز عن بطاقتك بنجاح وأمان."
                : "Authorization has been successfully voided."
              : ""}
          </Text>
        </View>

        {/* المتجر والفرع */}
        <View style={styles.card}>
          <View style={[styles.storeRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={styles.storeIconBox}>
              <Ionicons name="storefront-outline" size={22} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.storeName, { textAlign: isRTL ? "right" : "left" }]}>
                {storeInfo.name_ar || "المتجر"}
              </Text>
              <Text style={[styles.branchName, { textAlign: isRTL ? "right" : "left" }]}>
                {branchInfo.name_ar || branchInfo.address || "فرع المتجر"}
              </Text>
            </View>
          </View>
        </View>

        {/* عنوان التوصيل */}
        {order.delivery_type === "delivery" && (
          <View style={styles.card}>
            <View style={[styles.cardHeaderRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="location-outline" size={18} color="#2563EB" />
              <Text style={styles.cardSectionTitle}>
                {lang === "ar" ? "عنوان التوصيل" : "Delivery Address"}
              </Text>
            </View>
            <Text style={[styles.addressText, { textAlign: isRTL ? "right" : "left" }]}>
              {addressSnapshot.short_address || addressSnapshot.title || "العنوان المحدد"}
            </Text>
            {addressSnapshot.district_name ? (
              <Text style={[styles.addressSubText, { textAlign: isRTL ? "right" : "left" }]}>
                {addressSnapshot.district_name} {addressSnapshot.building ? `· مبنى ${addressSnapshot.building}` : ""}
              </Text>
            ) : null}
          </View>
        )}

        {/* تفاصيل المنتجات المحفوظة باللقطة الجامدة */}
        <View style={styles.card}>
          <View style={[styles.cardHeaderRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Ionicons name="fast-food-outline" size={18} color="#2563EB" />
            <Text style={styles.cardSectionTitle}>
              {lang === "ar" ? "أصناف الطلب" : "Order Items"}
            </Text>
          </View>

          <View style={styles.itemsList}>
            {itemsList.map((item: any, idx: number) => {
              const itemName = lang === "ar" ? item.name_ar : item.name_en || item.name_ar;
              const sizeName = item.size_name_ar ? ` (${item.size_name_ar})` : "";
              const optionsSummary =
                item.options && item.options.length > 0
                  ? item.options.map((o: any) => o.name_ar).join("، ")
                  : null;

              return (
                <View key={idx} style={[styles.itemRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>{item.quantity}x</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { textAlign: isRTL ? "right" : "left" }]}>
                      {itemName}
                      {sizeName}
                    </Text>
                    {optionsSummary ? (
                      <Text style={[styles.itemOptions, { textAlign: isRTL ? "right" : "left" }]}>
                        {optionsSummary}
                      </Text>
                    ) : null}
                    {item.notes ? (
                      <Text style={[styles.itemNotes, { textAlign: isRTL ? "right" : "left" }]}>
                        ملاحظة: {item.notes}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.itemPrice}>
                    {formatMoney(item.line_total_halalas || 0)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* تفضيلات العميل وملاحظات الطلب */}
        {(order.customer_notes || order.out_of_stock_action) && (
          <View style={styles.card}>
            <View style={[styles.cardHeaderRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color="#2563EB" />
              <Text style={styles.cardSectionTitle}>
                {lang === "ar" ? "ملاحظات وتفضيلات الطلب" : "Notes & Preferences"}
              </Text>
            </View>

            {order.customer_notes ? (
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>{lang === "ar" ? "ملاحظة للمتجر:" : "Store Note:"}</Text>
                <Text style={styles.prefValue}>{order.customer_notes}</Text>
              </View>
            ) : null}

            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>{lang === "ar" ? "عند نفاد صنف:" : "If item out of stock:"}</Text>
              <Text style={styles.prefValue}>
                {order.out_of_stock_action === "refund"
                  ? "حذف الصنف واسترداد مبلغه"
                  : order.out_of_stock_action === "contact"
                  ? "الاتصال بي لتحديد البديل"
                  : "إلغاء الطلب كاملاً"}
              </Text>
            </View>
          </View>
        )}

        {/* ملخص الفاتورة */}
        <View style={styles.card}>
          <View style={[styles.cardHeaderRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Ionicons name="receipt-outline" size={18} color="#2563EB" />
            <Text style={styles.cardSectionTitle}>
              {lang === "ar" ? "تفصيل الفاتورة" : "Payment Breakdown"}
            </Text>
          </View>

          <View style={styles.financialRows}>
            <View style={[styles.finRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text style={styles.finLabel}>{lang === "ar" ? "مجموع المنتجات" : "Items Subtotal"}</Text>
              <Text style={styles.finValue}>{formatMoney(order.items_total_halalas)}</Text>
            </View>

            {order.delivery_fee_halalas > 0 && (
              <View style={[styles.finRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={styles.finLabel}>{lang === "ar" ? "رسوم التوصيل" : "Delivery Fee"}</Text>
                <Text style={styles.finValue}>{formatMoney(order.delivery_fee_halalas)}</Text>
              </View>
            )}

            {order.service_fee_halalas > 0 && (
              <View style={[styles.finRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={styles.finLabel}>{lang === "ar" ? "رسوم الخدمة" : "Service Fee"}</Text>
                <Text style={styles.finValue}>{formatMoney(order.service_fee_halalas)}</Text>
              </View>
            )}

            {order.discount_halalas > 0 && (
              <View style={[styles.finRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={styles.discountLabel}>{lang === "ar" ? "الخصم" : "Discount"}</Text>
                <Text style={styles.discountValue}>-{formatMoney(order.discount_halalas)}</Text>
              </View>
            )}

            {order.tip_halalas > 0 && (
              <View style={[styles.finRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={styles.finLabel}>{lang === "ar" ? "الإكرامية" : "Tip"}</Text>
                <Text style={styles.finValue}>{formatMoney(order.tip_halalas)}</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={[styles.finRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text style={styles.totalLabel}>{lang === "ar" ? "المجموع الكلي" : "Total"}</Text>
              <Text style={styles.totalValue}>{formatMoney(order.total_halalas)}</Text>
            </View>

            <Text style={[styles.vatNote, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar" ? "الأسعار شاملة ضريبة القيمة المضافة 15%" : "All prices include 15% VAT"}
            </Text>
          </View>
        </View>

        {/* خط زمني للأحداث */}
        {history.length > 0 && (
          <View style={styles.card}>
            <View style={[styles.cardHeaderRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Ionicons name="time-outline" size={18} color="#2563EB" />
              <Text style={styles.cardSectionTitle}>
                {lang === "ar" ? "سجل حالات الطلب (ORD-001)" : "Status Timeline"}
              </Text>
            </View>

            <View style={styles.timelineList}>
              {history.map((h, i) => {
                const b = getStatusBadge(h.to_status);
                const isLast = i === history.length - 1;

                return (
                  <View key={h.id} style={[styles.timelineItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <View style={styles.timelineDotCol}>
                      <View style={[styles.timelineDot, isLast && { backgroundColor: b.color }]} />
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 16 }}>
                      <Text style={[styles.timelineTitle, { textAlign: isRTL ? "right" : "left" }]}>
                        {b.title}
                      </Text>
                      {h.reason ? (
                        <Text style={[styles.timelineReason, { textAlign: isRTL ? "right" : "left" }]}>
                          {h.reason}
                        </Text>
                      ) : null}
                      <Text style={[styles.timelineTime, { textAlign: isRTL ? "right" : "left" }]}>
                        {new Date(h.created_at).toLocaleTimeString("ar-SA", {
                          hour: "numeric",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* قسم وزر الإلغاء */}
        {isCancellableByCustomer && (
          <View style={styles.cancelSection}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setCancelModalVisible(true)}
            >
              <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
              <Text style={styles.cancelBtnText}>
                {lang === "ar" ? "إلغاء الطلب (متاح قبل التجهيز)" : "Cancel Order"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* نافذة إدخال سبب الإلغاء الإلزامي (ORD-004) */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {lang === "ar" ? "إلغاء الطلب (ORD-004)" : "Cancel Order"}
              </Text>
              <Text style={styles.modalSubTitle}>
                {lang === "ar"
                  ? "وفقاً للنظام، سبب الإلغاء إلزامي لتسجيله في السجل وتوجيهه لخدمة العملاء."
                  : "A cancellation reason is required according to regulations."}
              </Text>
            </View>

            {/* أسباب سريعة */}
            <View style={styles.quickReasons}>
              {[
                "تغيير رأيي",
                "أدخلت عنواناً خاطئاً",
                "أرغب بتعديل الأصناف",
                "تأخرت في تأكيد الطلب",
              ].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.quickReasonBtn,
                    cancelReason === reason && styles.quickReasonBtnActive,
                  ]}
                  onPress={() => setCancelReason(reason)}
                >
                  <Text
                    style={[
                      styles.quickReasonText,
                      cancelReason === reason && styles.quickReasonTextActive,
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.modalInput, { textAlign: isRTL ? "right" : "left" }]}
              placeholder={lang === "ar" ? "اكتب سبب الإلغاء هنا بالتفصيل..." : "Enter reason here..."}
              placeholderTextColor="#94A3B8"
              value={cancelReason}
              onChangeText={setCancelReason}
              maxLength={200}
              multiline
            />

            <View style={[styles.modalActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <TouchableOpacity
                style={styles.modalCancelAction}
                onPress={() => setCancelModalVisible(false)}
                disabled={cancelling}
              >
                <Text style={styles.modalCancelActionText}>{lang === "ar" ? "تراجع" : "Back"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmAction, !cancelReason.trim() && styles.modalConfirmActionDisabled]}
                onPress={handleCancelOrder}
                disabled={!cancelReason.trim() || cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmActionText}>
                    {lang === "ar" ? "تأكيد الإلغاء" : "Confirm Cancel"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitles: {
    alignItems: "center",
  },
  orderNumberText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  orderDateText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
  },
  backHomeBtn: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backHomeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  statusCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  statusHeaderRow: {
    alignItems: "center",
    gap: 12,
  },
  statusIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  statusDesc: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
    lineHeight: 18,
  },
  codeContainer: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  codeLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  codeDigits: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1D4ED8",
    letterSpacing: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  cardHeaderRow: {
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  storeRow: {
    alignItems: "center",
    gap: 12,
  },
  storeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  storeName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  branchName: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  addressText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 20,
  },
  addressSubText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  itemsList: {
    gap: 12,
  },
  itemRow: {
    alignItems: "flex-start",
    gap: 10,
  },
  qtyBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  qtyText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  itemOptions: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  itemNotes: {
    fontSize: 11,
    color: "#D97706",
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  prefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  prefLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  prefValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
  },
  financialRows: {
    gap: 8,
  },
  finRow: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  finLabel: {
    fontSize: 13,
    color: "#64748B",
  },
  finValue: {
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
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2563EB",
  },
  vatNote: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 4,
  },
  timelineList: {
    paddingTop: 8,
  },
  timelineItem: {
    gap: 12,
  },
  timelineDotCol: {
    alignItems: "center",
    width: 20,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#CBD5E1",
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    marginTop: 4,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  timelineReason: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
  },
  timelineTime: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  cancelSection: {
    marginTop: 8,
  },
  cancelBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cancelBtnText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    gap: 14,
  },
  modalHeader: {
    gap: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubTitle: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
  },
  quickReasons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickReasonBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickReasonBtnActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  quickReasonText: {
    fontSize: 11,
    color: "#475569",
  },
  quickReasonTextActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    height: 80,
    textAlignVertical: "top",
    fontSize: 13,
    color: "#0F172A",
  },
  modalActions: {
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  modalCancelAction: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  modalCancelActionText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  modalConfirmAction: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmActionDisabled: {
    opacity: 0.5,
  },
  modalConfirmActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  coolingOffCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "#FDE68A",
  },
  coolingOffHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  coolingOffTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#92400E",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  timerBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B45309",
  },
  coolingOffDesc: {
    fontSize: 12,
    color: "#78350F",
    lineHeight: 18,
    marginBottom: 12,
  },
  quickCancelBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 10,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  quickCancelBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  paymentRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  paymentRowLabel: {
    fontSize: 13,
    color: "#64748B",
  },
  paymentRowValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentStatusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  paymentSubtext: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 16,
  },
});

