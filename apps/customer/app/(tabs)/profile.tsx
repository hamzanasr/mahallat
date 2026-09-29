import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { Header } from "../../components/ui/Header";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

export default function ProfileScreen() {
  const { lang, t, isRTL, toggleLanguage, setLanguage } = useLanguage();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={t.customer?.profile?.title || "حسابي"} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* بطاقة الحساب كزائر */}
        <Card style={styles.guestCard}>
          <View
            style={[
              styles.guestRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <View style={styles.avatarCircle}>
              <Ionicons name="person-outline" size={32} color="#0284C7" />
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={[
                  styles.titleRow,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
                <Text
                  style={[
                    styles.guestTitle,
                    { textAlign: isRTL ? "right" : "left" },
                  ]}
                >
                  {t.customer?.profile?.guestTitle || "حساب زائر"}
                </Text>
                <View style={styles.guestBadge}>
                  <Text style={styles.guestBadgeText}>
                    {t.customer?.profile?.guestBadge || "تصفح حر"}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.guestDesc,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t.customer?.profile?.guestDescription ||
                  "أنت تتصفح كزائر. لن يُطلب منك تسجيل الدخول إلا عند حفظ عنوان أو إتمام الطلب."}
              </Text>
            </View>
          </View>
        </Card>

        {/* بطاقة اللغة والإعدادات */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {t.customer?.profile?.languageSection || "اللغة والإعدادات"}
          </Text>
        </View>

        <Card style={styles.settingsCard}>
          <View
            style={[
              styles.settingRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <View
              style={[
                styles.settingLabelGroup,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <Ionicons name="globe-outline" size={22} color="#475569" />
              <Text style={styles.settingLabel}>
                {t.customer?.profile?.currentLanguage || "اللغة الحالية"}
              </Text>
            </View>
            <Text style={styles.currentLangValue}>
              {lang === "ar" ? "العربية (RTL)" : "English (LTR)"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View
            style={[
              styles.langButtonsRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.langOption,
                lang === "ar" && styles.langOptionActive,
              ]}
              onPress={() => setLanguage("ar")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.langOptionText,
                  lang === "ar" && styles.langOptionTextActive,
                ]}
              >
                العربية
              </Text>
              {lang === "ar" && (
                <Ionicons name="checkmark-circle" size={18} color="#0284C7" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.langOption,
                lang === "en" && styles.langOptionActive,
              ]}
              onPress={() => setLanguage("en")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.langOptionText,
                  lang === "en" && styles.langOptionTextActive,
                ]}
              >
                English
              </Text>
              {lang === "en" && (
                <Ionicons name="checkmark-circle" size={18} color="#0284C7" />
              )}
            </TouchableOpacity>
          </View>

          <Button
            title={
              lang === "ar"
                ? "التبديل إلى English"
                : "Switch to العربية"
            }
            onPress={toggleLanguage}
            variant="outline"
            style={styles.toggleButton}
          />
        </Card>

        {/* تذييل الإصدار */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t.common.appName} · {t.customer?.profile?.appVersion || "الإصدار 1.0.0"}
          </Text>
          <Text style={styles.footerSubtext}>
            {lang === "ar"
              ? "تسجيل الدخول وإدارة الملف الشخصي في الخطوة 2.2"
              : "Login and profile details coming in Step 2.2"}
          </Text>
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
  guestCard: {
    marginBottom: 24,
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
  },
  guestRow: {
    alignItems: "flex-start",
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  guestBadge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  guestBadgeText: {
    fontSize: 11,
    color: "#0369A1",
    fontWeight: "600",
  },
  guestDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  settingsCard: {
    padding: 16,
    marginBottom: 24,
  },
  settingRow: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLabelGroup: {
    alignItems: "center",
    gap: 8,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  currentLangValue: {
    fontSize: 14,
    color: "#0284C7",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14,
  },
  langButtonsRow: {
    gap: 10,
    marginBottom: 14,
  },
  langOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  langOptionActive: {
    borderColor: "#0284C7",
    backgroundColor: "#F0F9FF",
  },
  langOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
  },
  langOptionTextActive: {
    fontWeight: "700",
    color: "#0284C7",
  },
  toggleButton: {
    marginTop: 4,
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  footerText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  footerSubtext: {
    fontSize: 12,
    color: "#CBD5E1",
    marginTop: 4,
  },
});
