import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { useDriver } from "../../context/DriverContext";
import { supabase } from "../../lib/supabase";
import { formatMoney, getNavigationUrl } from "@mahallat/shared";
import type { Database } from "@mahallat/shared";

type Order = Database["public"]["Tables"]["orders"]["Row"];

export default function DriverTaskDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { lang, isRTL } = useLanguage();
  const {
    arriveAtStore,
    pickupOrder,
    arriveAtCustomer,
    deliverOrder,
    currentLocation,
  } = useDriver();

  const [order, setOrder] = useState<Order | null>(null);
  const [store, setStore] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // حقول الإدخال
  const [pickupCodeInput, setPickupCodeInput] = useState("");
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState("https://placehold.co/400x300/10b981/ffffff.png?text=Pickup+Proof");
  const [deliveryCodeInput, setDeliveryCodeInput] = useState("");
  const [deliveryPhotoUrl, setDeliveryPhotoUrl] = useState("https://placehold.co/400x300/10b981/ffffff.png?text=Delivery+Proof");
  const [isLeaveAtDoor, setIsLeaveAtDoor] = useState(false);

  async function loadOrderDetails() {
    if (!id) return;
    try {
      const { data: ord, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

      if (ord) {
        setOrder(ord as Order);
        // تحميل المتجر والفرع
        const { data: st } = await supabase
          .from("stores")
          .select("name_ar, name_en, phone")
          .eq("id", ord.store_id)
          .single();
        if (st) setStore(st);

        const { data: br } = await supabase
          .from("store_branches")
          .select("name_ar, name_en, address_text")
          .eq("id", ord.branch_id)
          .single();
        if (br) setBranch(br);
      }
    } catch (err) {
      console.error("[loadOrderDetails error]", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrderDetails();

    // اشتراك لحظي في تحديثات هذا الطلب
    const sub = supabase
      .channel(`task_order_${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setOrder(payload.new as Order);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [id]);

  // الانتقال للملاحة (DRV-021)
  const openNavigation = (lat: number, lng: number, label: string) => {
    const url = getNavigationUrl(lat, lng, label);
    Linking.openURL(url);
  };

  // 1. وصل المتجر
  const handleArriveAtStore = async () => {
    if (!order) return;
    setActionLoading(true);
    const res = await arriveAtStore(order.id);
    setActionLoading(false);
    if (!res.success) {
      Alert.alert(lang === "ar" ? "تنبيه المسافة (ORD-005)" : "Geofence Alert", res.error || "يجب أن تكون داخل نطاق 100 متر من المتجر");
    } else {
      Alert.alert(lang === "ar" ? "تم بنجاح" : "Success", lang === "ar" ? "تم توثيق الوصول للمتجر بنجاح" : "Arrived at store verified");
      await loadOrderDetails();
    }
  };

  // 2. استلام الطلب من المتجر
  const handleConfirmPickup = async () => {
    if (!order) return;
    if (!pickupCodeInput) {
      Alert.alert(lang === "ar" ? "تنبيه" : "Notice", lang === "ar" ? "يرجى إدخال كود الاستلام من التاجر (ORD-005)" : "Enter pickup code from merchant");
      return;
    }
    setActionLoading(true);
    const res = await pickupOrder(order.id, pickupCodeInput.trim(), pickupPhotoUrl);
    setActionLoading(false);
    if (!res.success) {
      Alert.alert(lang === "ar" ? "فشل الاستلام" : "Pickup Failed", res.error || "تأكد من صحة الكود وموقعك داخل 100 متر");
    } else {
      Alert.alert(lang === "ar" ? "تم الاستلام" : "Picked Up", lang === "ar" ? "تم استلام الطلب وأنت الآن في الطريق للعميل!" : "Order picked up, now in transit!");
      await loadOrderDetails();
    }
  };

  // 3. وصل للعميل
  const handleArriveAtCustomer = async () => {
    if (!order) return;
    setActionLoading(true);
    const res = await arriveAtCustomer(order.id);
    setActionLoading(false);
    if (!res.success) {
      Alert.alert(lang === "ar" ? "تنبيه المسافة (ORD-005)" : "Geofence Alert", res.error || "يجب أن تكون داخل نطاق 100 متر من عنوان العميل");
    } else {
      Alert.alert(lang === "ar" ? "تم الوصول" : "Arrived", lang === "ar" ? "تم توثيق الوصول للعميل وإشعاره (ORD-008)" : "Arrived at customer verified");
      await loadOrderDetails();
    }
  };

  // 4. تسليم الطلب للعميل
  const handleConfirmDelivery = async () => {
    if (!order) return;
    if (!deliveryCodeInput) {
      Alert.alert(lang === "ar" ? "تنبيه" : "Notice", lang === "ar" ? "يرجى إدخال كود التسليم من العميل (ORD-005)" : "Enter delivery code from customer");
      return;
    }
    setActionLoading(true);
    const res = await deliverOrder(order.id, deliveryCodeInput.trim(), deliveryPhotoUrl, isLeaveAtDoor);
    setActionLoading(false);
    if (!res.success) {
      Alert.alert(lang === "ar" ? "فشل التسليم" : "Delivery Failed", res.error || "تأكد من الكود وموقعك داخل 100 متر");
    } else {
      Alert.alert(lang === "ar" ? "مبروك!" : "Congratulations!", lang === "ar" ? "تم تسليم واكتمال الطلب بنجاح، ونزلت أرباحك في محفظتك!" : "Order completed successfully!");
      router.replace("/(tabs)/orders");
    }
  };

  if (loading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const isPreparingOrReady = ["preparing", "ready_for_pickup"].includes(order.status);
  const isInTransit = ["picked_up", "in_transit"].includes(order.status);
  const isArrived = order.status === "arrived";
  const isCompleted = ["delivered", "completed"].includes(order.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* شريط الرأس */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#1F2937" />
          </TouchableOpacity>
          <View>
            <Text style={styles.orderNumber}>{order.order_number}</Text>
            <Text style={styles.headerStatus}>{order.status}</Text>
          </View>
          <View style={styles.earningsPill}>
            <Text style={styles.earningsText}>
              {formatMoney(order.delivery_fee_halalas || 1500, lang)}
            </Text>
          </View>
        </View>

        {/* مراحل المهمة الميدانية (DRV-004) */}

        {/* 1. مرحلة الاستلام من المتجر */}
        <View style={[styles.stageCard, isPreparingOrReady && styles.stageCardActive]}>
          <View style={styles.stageTitleRow}>
            <View style={[styles.stepNum, isPreparingOrReady && styles.stepNumActive]}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <Text style={styles.stageTitle}>{lang === "ar" ? "الاستلام من المتجر" : "Store Pickup"}</Text>
          </View>

          <Text style={styles.storeName}>{store?.name_ar || "المتجر"}</Text>
          <Text style={styles.branchAddress}>{branch?.address_text || "فرع جدة"}</Text>

          {/* زر الملاحة للمتجر DRV-021 */}
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => openNavigation(21.578, 39.141, store?.name_ar || "Store")}
          >
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text style={styles.navBtnText}>
              {lang === "ar" ? "فتح الملاحة للمتجر (Google Maps)" : "Navigate to Store"}
            </Text>
          </TouchableOpacity>

          {isPreparingOrReady && (
            <View style={styles.stageActions}>
              {!order.driver_at_store_at ? (
                <TouchableOpacity
                  style={styles.actionBtnPrimary}
                  onPress={handleArriveAtStore}
                  disabled={actionLoading}
                >
                  <Ionicons name="pin" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>
                    {lang === "ar" ? "وصلت المتجر (داخل 100م)" : "Arrived at Store (<=100m)"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.pickupForm}>
                  <Text style={styles.formHint}>
                    {lang === "ar"
                      ? "أدخل كود الاستلام من كاشير المتجر لالتقاط الطلب (ORD-005):"
                      : "Enter pickup code from merchant:"}
                  </Text>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="كود الاستلام (4 أرقام)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    value={pickupCodeInput}
                    onChangeText={setPickupCodeInput}
                    maxLength={6}
                  />

                  {/* زر التعبئة السريعة لتسهيل تجربة المالك */}
                  {order.pickup_code && (
                    <TouchableOpacity
                      style={styles.quickFillBtn}
                      onPress={() => setPickupCodeInput(order.pickup_code || "")}
                    >
                      <Text style={styles.quickFillText}>
                        {lang === "ar" ? `تعبئة الكود التجريبي (${order.pickup_code})` : `Fill Demo Code (${order.pickup_code})`}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.actionBtnPrimary}
                    onPress={handleConfirmPickup}
                    disabled={actionLoading}
                  >
                    <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>
                      {lang === "ar" ? "تأكيد الاستلام والانطلاق" : "Confirm Pickup & Head Out"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* 2. مرحلة التسليم للعميل */}
        <View style={[styles.stageCard, (isInTransit || isArrived) && styles.stageCardActive]}>
          <View style={styles.stageTitleRow}>
            <View style={[styles.stepNum, (isInTransit || isArrived) && styles.stepNumActive]}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <Text style={styles.stageTitle}>{lang === "ar" ? "التوصيل والتسليم للعميل" : "Customer Delivery"}</Text>
          </View>

          <Text style={styles.branchAddress}>
            {order.delivery_address_snapshot
              ? (order.delivery_address_snapshot as any).district || "حي جدة"
              : "موقع العميل المحدد على الخريطة"}
          </Text>

          {/* زر الملاحة للعميل DRV-021 */}
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => openNavigation(21.543, 39.172, "Customer")}
          >
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text style={styles.navBtnText}>
              {lang === "ar" ? "فتح الملاحة للعميل (Google Maps)" : "Navigate to Customer"}
            </Text>
          </TouchableOpacity>

          {(isInTransit || isArrived) && (
            <View style={styles.stageActions}>
              {!isArrived ? (
                <TouchableOpacity
                  style={styles.actionBtnPrimary}
                  onPress={handleArriveAtCustomer}
                  disabled={actionLoading}
                >
                  <Ionicons name="pin" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>
                    {lang === "ar" ? "وصلت للعميل (داخل 100م)" : "Arrived at Customer (<=100m)"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.pickupForm}>
                  <Text style={styles.formHint}>
                    {lang === "ar"
                      ? "أدخل كود التسليم من جوال العميل (ORD-005):"
                      : "Enter delivery code from customer:"}
                  </Text>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="كود التسليم (4 أرقام)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    value={deliveryCodeInput}
                    onChangeText={setDeliveryCodeInput}
                    maxLength={6}
                  />

                  {/* خيار الترك عند الباب ORD-010 */}
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setIsLeaveAtDoor(!isLeaveAtDoor)}
                  >
                    <Ionicons
                      name={isLeaveAtDoor ? "checkbox" : "square-outline"}
                      size={20}
                      color={isLeaveAtDoor ? "#10B981" : "#9CA3AF"}
                    />
                    <Text style={styles.checkboxText}>
                      {lang === "ar" ? "الترك عند الباب (بطلب العميل في المحادثة ORD-010)" : "Leave at door (customer requested)"}
                    </Text>
                  </TouchableOpacity>

                  {/* زر التعبئة السريعة لتسهيل تجربة المالك */}
                  {order.delivery_code && (
                    <TouchableOpacity
                      style={styles.quickFillBtn}
                      onPress={() => setDeliveryCodeInput(order.delivery_code || "")}
                    >
                      <Text style={styles.quickFillText}>
                        {lang === "ar" ? `تعبئة الكود التجريبي (${order.delivery_code})` : `Fill Demo Code (${order.delivery_code})`}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtnPrimary, { backgroundColor: "#10B981" }]}
                    onPress={handleConfirmDelivery}
                    disabled={actionLoading}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>
                      {lang === "ar" ? "تأكيد التسليم وإنهاء المهمة" : "Confirm Delivery & Finish"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {isCompleted && (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-done-circle" size={36} color="#10B981" />
            <Text style={styles.completedTitle}>
              {lang === "ar" ? "تم تسليم الطلب واكتمال المهمة بنجاح!" : "Order Delivered Successfully!"}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  backBtn: {
    padding: 6,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  headerStatus: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  earningsPill: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  earningsText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#10B981",
  },
  stageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    opacity: 0.7,
  },
  stageCardActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  stageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumActive: {
    backgroundColor: "#10B981",
  },
  stepNumText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  storeName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  branchAddress: {
    fontSize: 13,
    color: "#6B7280",
    marginVertical: 4,
  },
  navBtn: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    marginVertical: 10,
  },
  navBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  stageActions: {
    marginTop: 8,
  },
  actionBtnPrimary: {
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pickupForm: {
    gap: 10,
    marginTop: 6,
  },
  formHint: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "500",
  },
  codeInput: {
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 4,
    backgroundColor: "#F9FAFB",
  },
  quickFillBtn: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  quickFillText: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "600",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  checkboxText: {
    fontSize: 13,
    color: "#4B5563",
  },
  completedBanner: {
    backgroundColor: "#ECFDF5",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#065F46",
    textAlign: "center",
  },
});
