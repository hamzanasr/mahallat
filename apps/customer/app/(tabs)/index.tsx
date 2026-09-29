import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "../../context/LanguageContext";
import { useAddress } from "../../context/AddressContext";
import { Card } from "../../components/ui/Card";
import { supabase } from "../../lib/supabase";

interface SectionItem {
  key: string;
  nameAr: string;
  nameEn: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  settingKey: string;
  defaultEnabled: boolean;
}

const SECTIONS: SectionItem[] = [
  {
    key: "restaurants",
    nameAr: "مطاعم",
    nameEn: "Restaurants",
    icon: "restaurant-outline",
    color: "#EA580C",
    settingKey: "section_restaurants_enabled",
    defaultEnabled: true,
  },
  {
    key: "retail",
    nameAr: "محلات متنوعة",
    nameEn: "Retail Stores",
    icon: "bag-handle-outline",
    color: "#2563EB",
    settingKey: "section_retail_enabled",
    defaultEnabled: true,
  },
  {
    key: "mart",
    nameAr: "مارت وبقالة",
    nameEn: "Mart & Grocery",
    icon: "cart-outline",
    color: "#16A34A",
    settingKey: "section_mart_enabled",
    defaultEnabled: true,
  },
  {
    key: "pharmacy",
    nameAr: "صيدليات",
    nameEn: "Pharmacies",
    icon: "medkit-outline",
    color: "#DC2626",
    settingKey: "section_pharmacy_enabled",
    defaultEnabled: false, // افتراضياً مخفية حتى اكتمال الاشتراطات (المرحلة 13)
  },
  {
    key: "self_pickup",
    nameAr: "استلم بنفسك",
    nameEn: "Self Pickup",
    icon: "walk-outline",
    color: "#7C3AED",
    settingKey: "section_self_pickup_enabled",
    defaultEnabled: true,
  },
  {
    key: "taxi",
    nameAr: "تاكسي",
    nameEn: "Taxi",
    icon: "car-outline",
    color: "#CA8A04",
    settingKey: "section_taxi_enabled",
    defaultEnabled: true,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { lang, t, isRTL } = useLanguage();
  const { currentDisplayLabel } = useAddress();
  const [sectionStatus, setSectionStatus] = useState<Record<string, boolean>>({
    section_restaurants_enabled: true,
    section_retail_enabled: true,
    section_mart_enabled: true,
    section_pharmacy_enabled: false,
    section_self_pickup_enabled: true,
    section_taxi_enabled: true,
  });

  useEffect(() => {
    // محاولة جلب حالة تفعيل الأقسام من إعدادات Supabase
    async function loadSectionSettings() {
      try {
        const updated: Record<string, boolean> = { ...sectionStatus };
        await Promise.all(
          SECTIONS.map(async (section) => {
            const { data, error } = await supabase.rpc("get_setting", {
              p_key: section.settingKey,
            });
            if (!error && data !== null && data !== undefined) {
              const val =
                typeof data === "string" ? JSON.parse(data) : data;
              updated[section.settingKey] = Boolean(val);
            }
          })
        );
        setSectionStatus(updated);
      } catch {
        // في حال عدم توفر الاتصال نعتمد القيم الافتراضية
      }
    }
    loadSectionSettings();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* شريط اختيار العنوان والتوصيل الحالي (CUS-002) */}
        <View
          style={[
            styles.header,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.locationSelector,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
            onPress={() => router.push("/address/select")}
          >
            <View style={styles.locationPinIcon}>
              <Ionicons name="location" size={18} color="#2563eb" />
            </View>
            <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", flex: 1, marginHorizontal: 8 }}>
              <Text style={styles.deliverToLabel}>
                {t.customer?.address?.currentLocationHeader || "التوصيل إلى"}
              </Text>
              <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 4 }}>
                <Text style={styles.locationTitle} numberOfLines={1}>
                  {currentDisplayLabel}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#64748b" />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapIconButton}
            onPress={() => router.push("/address/new")}
          >
            <Ionicons name="map-outline" size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>

        {/* تنبيه الخطوة المؤقتة */}
        <Card style={styles.infoCard}>
          <View
            style={[
              styles.infoRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <Ionicons name="information-circle" size={24} color="#0284C7" />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.infoTitle,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t.customer?.home?.title || "الرئيسية"}
              </Text>
              <Text
                style={[
                  styles.infoDesc,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {lang === "ar"
                  ? "صفحة التصفح الرئيسية جاهزة (CUS-001). سيتم ربط قائمة المتاجر الحقيقية والتصنيفات والمنتجات في الخطوة 2.5."
                  : "Home browsing foundation is ready (CUS-001). Stores, categories, and items will be loaded in Step 2.5."}
              </Text>
            </View>
          </View>
        </Card>

        {/* قسم استعراض الأقسام وحالة تفعيلها */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {t.customer?.home?.sectionsTitle || "الأقسام"}
          </Text>
        </View>

        <View style={styles.grid}>
          {SECTIONS.map((section) => {
            const isEnabled = sectionStatus[section.settingKey] ?? section.defaultEnabled;
            const title = lang === "ar" ? section.nameAr : section.nameEn;

            return (
              <TouchableOpacity
                key={section.key}
                style={[
                  styles.sectionCard,
                  !isEnabled && styles.sectionCardDisabled,
                ]}
                activeOpacity={isEnabled ? 0.7 : 1}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isEnabled ? section.color + "15" : "#F1F5F9" },
                  ]}
                >
                  <Ionicons
                    name={section.icon}
                    size={28}
                    color={isEnabled ? section.color : "#94A3B8"}
                  />
                </View>
                <Text
                  style={[
                    styles.sectionCardText,
                    !isEnabled && styles.sectionCardTextDisabled,
                  ]}
                >
                  {title}
                </Text>
                {!isEnabled && (
                  <View style={styles.hiddenTag}>
                    <Text style={styles.hiddenTagText}>
                      {lang === "ar" ? "مخفي نظاماً" : "Hidden"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 8,
  },
  locationSelector: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginEnd: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  locationPinIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  deliverToLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
    maxWidth: 180,
  },
  mapIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  appName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },
  appTagline: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
  guestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  guestBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0369A1",
  },
  infoCard: {
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
    marginBottom: 24,
  },
  infoRow: {
    alignItems: "flex-start",
    gap: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0369A1",
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 13,
    color: "#0C4A6E",
    lineHeight: 19,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E293B",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  sectionCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionCardDisabled: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    opacity: 0.7,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  sectionCardText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    textAlign: "center",
  },
  sectionCardTextDisabled: {
    color: "#94A3B8",
  },
  hiddenTag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  hiddenTagText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
});
