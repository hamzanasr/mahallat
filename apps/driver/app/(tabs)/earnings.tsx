import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { useDriverAuth } from "../../context/DriverAuthContext";
import { supabase } from "../../lib/supabase";
import { formatMoney } from "@mahallat/shared";

export default function DriverEarningsScreen() {
  const { lang } = useLanguage();
  const { user } = useDriverAuth();
  const [totalCompleted, setTotalCompleted] = useState<number>(0);
  const [totalEarningsHalalas, setTotalEarningsHalalas] = useState<number>(0);
  const [tipHalalas, setTipHalalas] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEarnings() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("delivery_fee_halalas, tip_halalas, status")
          .eq("driver_id", user.id)
          .eq("status", "completed");

        if (data && !error) {
          setTotalCompleted(data.length);
          const fees = data.reduce((acc, curr) => acc + (curr.delivery_fee_halalas || 0), 0);
          const tips = data.reduce((acc, curr) => acc + (curr.tip_halalas || 0), 0);
          setTotalEarningsHalalas(fees + tips);
          setTipHalalas(tips);
        }
      } catch (err) {
        console.error("[loadEarnings error]", err);
      } finally {
        setLoading(false);
      }
    }
    loadEarnings();
  }, [user]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{lang === "ar" ? "كشف الأرباح والمستحقات" : "Earnings & Payouts"}</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* بطاقة الرصيد الإجمالي */}
            <View style={styles.mainCard}>
              <Text style={styles.mainCardLabel}>
                {lang === "ar" ? "إجمالي الأرباح المكتملة" : "Total Completed Earnings"}
              </Text>
              <Text style={styles.mainCardAmount}>
                {formatMoney(totalEarningsHalalas, lang)}
              </Text>
              <Text style={styles.mainCardSubtitle}>
                {lang === "ar" ? "تشمل رسوم التوصيل والإكراميات" : "Includes delivery fees and tips"}
              </Text>
            </View>

            {/* إحصائيات سريعة */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />
                <Text style={styles.statValue}>{totalCompleted}</Text>
                <Text style={styles.statLabel}>
                  {lang === "ar" ? "الطلبات المنجزة" : "Completed Orders"}
                </Text>
              </View>

              <View style={styles.statBox}>
                <Ionicons name="heart-outline" size={24} color="#EC4899" />
                <Text style={styles.statValue}>{formatMoney(tipHalalas, lang)}</Text>
                <Text style={styles.statLabel}>
                  {lang === "ar" ? "إكراميات العملاء" : "Customer Tips"}
                </Text>
              </View>
            </View>

            {/* نصيحة نظامية */}
            <View style={styles.infoBox}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#059669" />
              <Text style={styles.infoText}>
                {lang === "ar"
                  ? "تُحسب مستحقاتك بالهللة وبشكل فوري بعد كل عملية تسليم ناجحة، وتتحول لحسابك البنكي وفق جدول التسويات الأسبوعي (DRV-005)."
                  : "Earnings are computed in halalas immediately upon successful delivery, paid out according to the weekly settlement schedule (DRV-005)."}
              </Text>
            </View>
          </>
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
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
  },
  mainCard: {
    backgroundColor: "#10B981",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#10B981",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  mainCardLabel: {
    color: "#D1FAE5",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  mainCardAmount: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 4,
  },
  mainCardSubtitle: {
    color: "#ECFDF5",
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
    marginVertical: 6,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  infoBox: {
    backgroundColor: "#ECFDF5",
    padding: 14,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
});
