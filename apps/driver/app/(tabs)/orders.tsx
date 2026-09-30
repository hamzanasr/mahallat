import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { useDriverAuth } from "../../context/DriverAuthContext";
import { supabase } from "../../lib/supabase";
import { formatMoney } from "@mahallat/shared";
import type { Database } from "@mahallat/shared";

type Order = Database["public"]["Tables"]["orders"]["Row"];

export default function DriverOrdersScreen() {
  const router = useRouter();
  const { lang, isRTL } = useLanguage();
  const { user } = useDriverAuth();
  const [tab, setTab] = useState<"active" | "history">("active");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });

      if (tab === "active") {
        query = query.in("status", [
          "preparing",
          "ready_for_pickup",
          "picked_up",
          "in_transit",
          "arrived",
        ]);
      } else {
        query = query.in("status", [
          "completed",
          "cancelled",
          "ended_no_response",
          "returned_to_pharmacy",
        ]);
      }

      const { data } = await query;
      if (data) setOrders(data as Order[]);
    } catch (err) {
      console.error("[loadOrders error]", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [user, tab]);

  // وسم الخدمة واللون (DRV-002: المطاعم أحمر، المارت أزرق، الصيدليات أخضر)
  const getServiceBadge = (deliveryType: string) => {
    // يمكن تمييز نوع النشاط من بيانات الطلب
    return {
      label: lang === "ar" ? "مطاعم" : "Restaurant",
      color: "#EF4444",
      bgColor: "#FEE2E2",
    };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>{lang === "ar" ? "قائمة الطلبات والخدمات" : "Orders & Services"}</Text>
      </View>

      {/* شريط التبويب */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "active" && styles.tabBtnActive]}
          onPress={() => setTab("active")}
        >
          <Text style={[styles.tabBtnText, tab === "active" && styles.tabBtnTextActive]}>
            {lang === "ar" ? "الطلبات الحالية" : "Active"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "history" && styles.tabBtnActive]}
          onPress={() => setTab("history")}
        >
          <Text style={[styles.tabBtnText, tab === "history" && styles.tabBtnTextActive]}>
            {lang === "ar" ? "السجل المكتمل" : "History"}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={54} color="#9CA3AF" />
          <Text style={styles.emptyText}>
            {tab === "active"
              ? (lang === "ar" ? "لا توجد طلبات جارية الآن" : "No active orders right now")
              : (lang === "ar" ? "لا يوجد سجل طلبات سابقة" : "No past orders")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const badge = getServiceBadge(item.delivery_type);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/task/${item.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.orderIdWrapper}>
                    <Text style={styles.orderNumber}>{item.order_number}</Text>
                    {/* وسم لون الخدمة DRV-002 */}
                    <View style={[styles.serviceTag, { backgroundColor: badge.bgColor }]}>
                      <Text style={[styles.serviceTagText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                  <Text style={styles.feeText}>
                    {formatMoney(item.delivery_fee_halalas || 1500, lang)}
                  </Text>
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
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: "#10B981",
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 12,
    textAlign: "center",
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderIdWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  serviceTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  serviceTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  cardBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  feeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
});
