import React, { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "../../context/LanguageContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { Header } from "../../components/ui/Header";
import { EmptyState } from "../../components/ui/EmptyState";
import { supabase } from "../../lib/supabase";
import { formatMoney } from "@mahallat/shared";

interface OrderSummary {
  id: string;
  order_number: string;
  status: string;
  total_halalas: number;
  delivery_type: string;
  created_at: string;
  order_snapshot: any;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { lang, isRTL } = useLanguage();
  const { user } = useCustomerAuth();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "past">("active");

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_halalas, delivery_type, created_at, order_snapshot")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOrders(data as unknown as OrderSummary[]);
      }
    } catch (err) {
      console.error("خطأ جلب الطلبات:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();

    if (!user) return;
    const channel = supabase
      .channel("customer-orders-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const isOrderActive = (status: string) => {
    return ![
      "completed",
      "delivered",
      "cancelled",
      "ended_no_response",
      "self_pickup_expired",
      "returned_to_pharmacy",
    ].includes(status);
  };

  const filteredOrders = orders.filter((o) =>
    activeTab === "active" ? isOrderActive(o.status) : !isOrderActive(o.status)
  );

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending_payment":
        return { label: lang === "ar" ? "بانتظار الدفع" : "Pending Payment", color: "#2563EB", bg: "#EFF6FF" };
      case "cooling_off":
        return { label: lang === "ar" ? "مهلة التراجع (60ث)" : "Cooling-off (60s)", color: "#059669", bg: "#ECFDF5" };
      case "pending_driver":
        return { label: lang === "ar" ? "بانتظار مندوب" : "Finding Driver", color: "#D97706", bg: "#FEF3C7" };
      case "preparing":
        return { label: lang === "ar" ? "جاري التجهيز" : "Preparing", color: "#EA580C", bg: "#FFF7ED" };
      case "ready_for_pickup":
        return { label: lang === "ar" ? "جاهز للاستلام" : "Ready", color: "#16A34A", bg: "#F0FDF4" };
      case "picked_up":
      case "in_transit":
        return { label: lang === "ar" ? "في الطريق" : "In Transit", color: "#1D4ED8", bg: "#EFF6FF" };
      case "arrived":
        return { label: lang === "ar" ? "المندوب عند الباب" : "Arrived", color: "#7E22CE", bg: "#FAF5FF" };
      case "delivered":
      case "completed":
        return { label: lang === "ar" ? "مكتمل" : "Completed", color: "#15803D", bg: "#F0FDF4" };
      case "cancelled":
        return { label: lang === "ar" ? "ملغي" : "Cancelled", color: "#DC2626", bg: "#FEF2F2" };
      default:
        return { label: status, color: "#475569", bg: "#F1F5F9" };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <Header title={lang === "ar" ? "طلباتي" : "My Orders"} />

      {/* شريط التبويب: نشطة مقابل سابقة */}
      <View style={[styles.tabBar, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "active" && styles.tabBtnActive]}
          onPress={() => setActiveTab("active")}
        >
          <Text style={[styles.tabBtnText, activeTab === "active" && styles.tabBtnTextActive]}>
            {lang === "ar" ? "الطلبات الحالية" : "Active Orders"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "past" && styles.tabBtnActive]}
          onPress={() => setActiveTab("past")}
        >
          <Text style={[styles.tabBtnText, activeTab === "past" && styles.tabBtnTextActive]}>
            {lang === "ar" ? "الطلبات السابقة" : "Past Orders"}
          </Text>
        </TouchableOpacity>
      </View>

      {!user ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            iconName="log-in-outline"
            title={lang === "ar" ? "يرجى تسجيل الدخول" : "Please Log In"}
            description={
              lang === "ar"
                ? "سجّل الدخول لتتمكن من متابعة وتتبع طلباتك الحالية والسابقة."
                : "Log in to track your current and past orders."
            }
          />
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/auth" as any)}
          >
            <Text style={styles.loginBtnText}>
              {lang === "ar" ? "تسجيل الدخول" : "Log In"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            {lang === "ar" ? "جاري تحميل الطلبات..." : "Loading orders..."}
          </Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            iconName="receipt-outline"
            title={
              activeTab === "active"
                ? lang === "ar" ? "لا توجد طلبات جارية حالياً" : "No active orders"
                : lang === "ar" ? "لا توجد طلبات سابقة" : "No past orders"
            }
            description={
              lang === "ar"
                ? "عندما تطلب وجبتك أو مشترياتك المفضلة ستظهر هنا لمتابعتها لحظة بلحظة."
                : "When you place an order, it will appear here."
            }
          />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const statusInfo = getStatusLabel(item.status);
            const snapshot = item.order_snapshot || {};
            const storeName = snapshot.store?.name_ar || (lang === "ar" ? "متجر محلي" : "Local Store");
            const itemsCount = snapshot.items?.length || 1;

            return (
              <TouchableOpacity
                style={styles.orderCard}
                onPress={() =>
                  router.push({
                    pathname: "/order/[id]",
                    params: { id: item.id },
                  } as any)
                }
              >
                <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.storeTitle, { textAlign: isRTL ? "right" : "left" }]}>
                      {storeName}
                    </Text>
                    <Text style={[styles.orderNumber, { textAlign: isRTL ? "right" : "left" }]}>
                      {item.order_number}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.badgeText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={[styles.cardFooter, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.itemsSummary}>
                      {lang === "ar" ? `${itemsCount} صنف` : `${itemsCount} items`} ·{" "}
                      {new Date(item.created_at).toLocaleDateString("ar-SA", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View style={[styles.priceBox, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={styles.totalPrice}>{formatMoney(item.total_halalas)}</Text>
                    <Ionicons
                      name={isRTL ? "chevron-back" : "chevron-forward"}
                      size={16}
                      color="#94A3B8"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  tabBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: "#2563EB",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  loginBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  cardHeader: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  storeTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  orderNumber: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  cardFooter: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemsSummary: {
    fontSize: 12,
    color: "#64748B",
  },
  priceBox: {
    alignItems: "center",
    gap: 4,
  },
  totalPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563EB",
  },
});
