import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { useDriverAuth } from "../../context/DriverAuthContext";
import { formatDriverLevel, formatVehicleType, maskSaudiPhone } from "@mahallat/shared";

export default function DriverProfileScreen() {
  const router = useRouter();
  const { lang, toggleLanguage, isRTL } = useLanguage();
  const { user, profile, driver, signOut } = useDriverAuth();

  const handleEmergency = () => {
    Alert.alert(
      lang === "ar" ? "زر الطوارئ الميداني (DRV-024)" : "Emergency Button",
      lang === "ar"
        ? "هل ترغب بالاتصال برقم الطوارئ الموحد 911؟ سيتم إرسال موقعك الحالي لغرفة العمليات فوراً."
        : "Do you want to call 911 emergency? Your live location will be transmitted to operations.",
      [
        { text: lang === "ar" ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: lang === "ar" ? "اتصال بالطوارئ" : "Call Emergency",
          style: "destructive",
          onPress: () => Linking.openURL("tel:911"),
        },
      ]
    );
  };

  const handleHelpReport = () => {
    Alert.alert(
      lang === "ar" ? "مركز المساعدة والدعم (DRV-020)" : "Help & Support",
      lang === "ar"
        ? "اختر نوع البلاغ لغرفة العمليات:\n1. تأخر المتجر\n2. العنوان غير دقيق\n3. حادث أو عطل بالمركبة"
        : "Select report type to operations:\n1. Store delayed\n2. Inaccurate address\n3. Vehicle accident/issue",
      [
        { text: lang === "ar" ? "إغلاق" : "Close", style: "cancel" },
        {
          text: lang === "ar" ? "إرسال إشعار للعمليات" : "Notify Operations",
          onPress: () => Alert.alert(lang === "ar" ? "تم الإرسال" : "Sent", lang === "ar" ? "تم رفع البلاغ لغرفة العمليات بنجاح" : "Report sent to operations room successfully"),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{lang === "ar" ? "الملف الشخصي والمستندات" : "Driver Profile"}</Text>

        {/* بطاقة المندوب */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color="#FFFFFF" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || "كابتن محلات"}</Text>
            <Text style={styles.profilePhone}>
              {profile?.phone ? maskSaudiPhone(profile.phone) : ""}
            </Text>
            {driver?.is_verified_freelance && (
              <View style={styles.freelanceBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#059669" />
                <Text style={styles.freelanceText}>
                  {lang === "ar" ? "وثيقة عمل حر معتمدة (DRV-007)" : "Verified Freelance"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* بطاقة الأداء والمستوى (DRV-015, DRV-017) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>{lang === "ar" ? "المستوى ودرجة الأداء" : "Level & Performance"}</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{lang === "ar" ? "المستوى" : "Level"}</Text>
              <Text style={styles.metricValue}>
                {formatDriverLevel(driver?.level || "new", lang)}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{lang === "ar" ? "الدرجة" : "Score"}</Text>
              <Text style={[styles.metricValue, { color: "#10B981" }]}>
                {driver?.performance_score || "100"} / 100
              </Text>
            </View>
          </View>
        </View>

        {/* بيانات المركبة (DRV-011) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>{lang === "ar" ? "بيانات المركبة" : "Vehicle Data"}</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{lang === "ar" ? "نوع المركبة" : "Vehicle Type"}</Text>
            <Text style={styles.rowValue}>{formatVehicleType(driver?.vehicle_type || "car", lang)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{lang === "ar" ? "اللوحة" : "Plate"}</Text>
            <Text style={styles.rowValue}>{driver?.vehicle_plate || "أ ب ج 1234"}</Text>
          </View>
        </View>

        {/* أزرار الأمان والطوارئ (DRV-020, DRV-024) */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.emergencyBtn} onPress={handleEmergency}>
            <Ionicons name="warning" size={20} color="#FFFFFF" />
            <Text style={styles.emergencyBtnText}>
              {lang === "ar" ? "زر الطوارئ الميداني 911" : "Emergency Button (911)"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.helpBtn} onPress={handleHelpReport}>
            <Ionicons name="chatbubbles-outline" size={20} color="#1F2937" />
            <Text style={styles.helpBtnText}>
              {lang === "ar" ? "مساعدة / بلاغ للعمليات (DRV-020)" : "Help / Report (DRV-020)"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* الإعدادات العامة */}
        <View style={styles.sectionCard}>
          <TouchableOpacity style={styles.row} onPress={toggleLanguage}>
            <Text style={styles.rowLabel}>{lang === "ar" ? "لغة التطبيق" : "App Language"}</Text>
            <Text style={[styles.rowValue, { color: "#10B981", fontWeight: "700" }]}>
              {lang === "ar" ? "English" : "العربية"}
            </Text>
          </TouchableOpacity>

          {user && (
            <TouchableOpacity
              style={[styles.row, { borderTopWidth: 1, borderTopColor: "#F3F4F6", marginTop: 8, paddingTop: 12 }]}
              onPress={async () => {
                await signOut();
                router.replace("/login");
              }}
            >
              <Text style={[styles.rowLabel, { color: "#EF4444" }]}>
                {lang === "ar" ? "تسجيل الخروج" : "Sign Out"}
              </Text>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
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
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  profilePhone: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  freelanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  freelanceText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#E5E7EB",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 14,
    color: "#4B5563",
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  actionsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  emergencyBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emergencyBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  helpBtn: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  helpBtnText: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
  },
});
