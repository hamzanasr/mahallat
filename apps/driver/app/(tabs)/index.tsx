import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { useDriverAuth } from "../../context/DriverAuthContext";
import { useDriver } from "../../context/DriverContext";
import { formatMoney } from "@mahallat/shared";

export default function DriverHomeScreen() {
  const router = useRouter();
  const { isRTL, lang } = useLanguage();
  const { user, profile, driver, loading: authLoading } = useDriverAuth();
  const {
    isOnline,
    toggleOnline,
    acknowledgeUniform,
    incomingOffer,
    acceptOffer,
    rejectOffer,
    activeTasks,
  } = useDriver();

  const [uniformModalVisible, setUniformModalVisible] = useState(false);
  const [offerCountdown, setOfferCountdown] = useState<number>(30);
  const [actionLoading, setActionLoading] = useState(false);

  // حساب العد التنازلي للعرض اللحظي
  useEffect(() => {
    if (!incomingOffer) {
      setOfferCountdown(30);
      return;
    }

    const timer = setInterval(() => {
      const remainingMs = new Date(incomingOffer.expires_at).getTime() - Date.now();
      const secs = Math.max(0, Math.ceil(remainingMs / 1000));
      setOfferCountdown(secs);

      if (secs <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingOffer]);

  const handleToggleOnline = async (val: boolean) => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (val && !driver?.uniform_acknowledged_at) {
      setUniformModalVisible(true);
      return;
    }

    setActionLoading(true);
    const res = await toggleOnline(val);
    setActionLoading(false);
    if (!res.success) {
      Alert.alert(lang === "ar" ? "تنبيه" : "Notice", res.error || "فشل تغيير الحالة");
    }
  };

  const handleConfirmUniform = async () => {
    setActionLoading(true);
    const ackRes = await acknowledgeUniform();
    if (ackRes.success) {
      setUniformModalVisible(false);
      await toggleOnline(true);
    } else {
      Alert.alert("خطأ", ackRes.error || "فشل تسجيل الإقرار");
    }
    setActionLoading(false);
  };

  const handleAcceptOffer = async (orderId: string) => {
    setActionLoading(true);
    const res = await acceptOffer(orderId);
    setActionLoading(false);
    if (res.success) {
      router.push(`/task/${orderId}`);
    } else {
      Alert.alert(lang === "ar" ? "تنبيه" : "Notice", res.error || "فشل قبول المهمة");
    }
  };

  const handleRejectOffer = async (orderId: string) => {
    setActionLoading(true);
    await rejectOffer(orderId);
    setActionLoading(false);
  };

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* شريط الرأس */}
        <View style={styles.header}>
          <View>
            <Text style={styles.driverName}>
              {user ? (profile?.full_name || "كابتن محلات") : (lang === "ar" ? "تسجيل الدخول" : "Sign In")}
            </Text>
            <Text style={styles.driverStatus}>
              {isOnline
                ? (lang === "ar" ? "🟢 جاهز لاستقبال الطلبات" : "🟢 Online & Receiving Orders")
                : (lang === "ar" ? "⚪ غير متاح حالياً" : "⚪ Currently Offline")}
            </Text>
          </View>
          <View style={styles.switchWrapper}>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: "#D1D5DB", true: "#10B981" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {!user && (
          <TouchableOpacity
            style={styles.loginBanner}
            onPress={() => router.push("/login")}
          >
            <Ionicons name="log-in-outline" size={24} color="#FFFFFF" />
            <Text style={styles.loginBannerText}>
              {lang === "ar" ? "سجّل الدخول برقم جوالك لبدء العمل" : "Sign in with your phone to start"}
            </Text>
          </TouchableOpacity>
        )}

        {/* عرض الطلب الجديد المنبثق (Offer Banner) */}
        {incomingOffer && (
          <View style={styles.offerCard}>
            <View style={styles.offerHeader}>
              <View style={styles.offerBadge}>
                <Ionicons name="flash" size={16} color="#B45309" />
                <Text style={styles.offerBadgeText}>
                  {lang === "ar" ? "عرض جديد متاح!" : "New Offer Available!"}
                </Text>
              </View>
              <View style={styles.countdownBadge}>
                <Ionicons name="timer-outline" size={14} color="#EF4444" />
                <Text style={styles.countdownText}>{offerCountdown}s</Text>
              </View>
            </View>

            <View style={styles.offerDetails}>
              <View style={styles.offerRow}>
                <Text style={styles.offerLabel}>{lang === "ar" ? "العائد المتوقع:" : "Expected Earnings:"}</Text>
                <Text style={styles.earningsAmount}>
                  {formatMoney(incomingOffer.estimated_earnings_halalas, lang)}
                </Text>
              </View>
              <View style={styles.offerRow}>
                <Text style={styles.offerLabel}>{lang === "ar" ? "المسافة الإجمالية:" : "Total Distance:"}</Text>
                <Text style={styles.offerValue}>
                  {((incomingOffer.distance_to_pickup_km || 1) + (incomingOffer.distance_pickup_to_delivery_km || 3)).toFixed(1)} كم
                </Text>
              </View>
            </View>

            <View style={styles.offerActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleRejectOffer(incomingOffer.order_id)}
                disabled={actionLoading}
              >
                <Text style={styles.rejectBtnText}>{lang === "ar" ? "تجاهل" : "Decline"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => handleAcceptOffer(incomingOffer.order_id)}
                disabled={actionLoading}
              >
                <Text style={styles.acceptBtnText}>{lang === "ar" ? "قبول المهمة" : "Accept"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* المهام النشطة الحالية (Active Tasks) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {lang === "ar" ? "المهام الحالية" : "Active Tasks"} ({activeTasks.length}/3)
          </Text>
        </View>

        {activeTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="bicycle-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>
              {lang === "ar" ? "لا توجد مهام نشطة حالياً" : "No active tasks right now"}
            </Text>
            <Text style={styles.emptyDesc}>
              {isOnline
                ? (lang === "ar" ? "خليك متصل؛ العروض ستصلك تلقائياً عند طلب العملاء القريبين" : "Stay online; offers will arrive when nearby customers order")
                : (lang === "ar" ? "شغّل زر الاتصال بالأعلى لبدء استقبال عروض التوصيل" : "Toggle online switch above to start receiving offers")}
            </Text>
          </View>
        ) : (
          activeTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskCard}
              onPress={() => router.push(`/task/${task.id}`)}
            >
              <View style={styles.taskCardHeader}>
                <Text style={styles.orderNumber}>{task.order_number}</Text>
                <View style={styles.taskStatusBadge}>
                  <Text style={styles.taskStatusText}>{task.status}</Text>
                </View>
              </View>

              <View style={styles.taskCardBody}>
                <View style={styles.pointRow}>
                  <Ionicons name="storefront-outline" size={16} color="#10B981" />
                  <Text style={styles.pointText}>{lang === "ar" ? "استلام من المتجر" : "Pickup from store"}</Text>
                </View>
                <View style={styles.pointRow}>
                  <Ionicons name="location-outline" size={16} color="#3B82F6" />
                  <Text style={styles.pointText}>{lang === "ar" ? "تسليم للعميل" : "Deliver to customer"}</Text>
                </View>
              </View>

              <View style={styles.taskCardFooter}>
                <Text style={styles.taskEarnings}>
                  {formatMoney(task.delivery_fee_halalas || 1500, lang)}
                </Text>
                <View style={styles.openTaskBtn}>
                  <Text style={styles.openTaskText}>{lang === "ar" ? "متابعة المهمة" : "Track Task"}</Text>
                  <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={16} color="#10B981" />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* نافذة إقرار الزي الموحد (DRV-010) */}
      <Modal visible={uniformModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Ionicons name="shirt-outline" size={48} color="#10B981" style={{ alignSelf: "center", marginBottom: 12 }} />
            <Text style={styles.modalTitle}>
              {lang === "ar" ? "إقرار الالتزام بالزي الموحد" : "Uniform Acknowledgment"}
            </Text>
            <Text style={styles.modalDesc}>
              {lang === "ar"
                ? "وفق الاشتراطات النظامية، أقر بالتزامي الكامل بارتداء الزي الموحد وحمل حقيبة التوصيل الحرارية والنظافة الشخصية طوال فترة العمل (DRV-010)."
                : "In compliance with regulations, I acknowledge full adherence to wearing the official uniform, thermal bag, and hygiene throughout my shift (DRV-010)."}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelModalBtn]}
                onPress={() => setUniformModalVisible(false)}
              >
                <Text style={styles.cancelModalText}>{lang === "ar" ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmModalBtn]}
                onPress={handleConfirmUniform}
                disabled={actionLoading}
              >
                <Text style={styles.confirmModalText}>{lang === "ar" ? "أقر وألتزم" : "I Agree"}</Text>
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
    backgroundColor: "#F9FAFB",
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  driverName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  driverStatus: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  switchWrapper: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  loginBanner: {
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    gap: 8,
  },
  loginBannerText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  offerCard: {
    backgroundColor: "#FFFBEB",
    borderWidth: 2,
    borderColor: "#F59E0B",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#F59E0B",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  offerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  offerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  offerBadgeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#B45309",
  },
  countdownBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EF4444",
  },
  offerDetails: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  offerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  offerLabel: {
    fontSize: 14,
    color: "#4B5563",
  },
  earningsAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#10B981",
  },
  offerValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  offerActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    backgroundColor: "#E5E7EB",
  },
  rejectBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4B5563",
  },
  acceptBtn: {
    backgroundColor: "#10B981",
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  taskCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  taskStatusBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  taskStatusText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
  },
  taskCardBody: {
    gap: 6,
    marginBottom: 12,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pointText: {
    fontSize: 13,
    color: "#4B5563",
  },
  taskCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
  },
  taskEarnings: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
  openTaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  openTaskText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelModalBtn: {
    backgroundColor: "#F3F4F6",
  },
  cancelModalText: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "600",
  },
  confirmModalBtn: {
    backgroundColor: "#10B981",
  },
  confirmModalText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
