import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "../context/LanguageContext";
import { Header } from "../components/ui/Header";
import { Card } from "../components/ui/Card";

export default function TermsScreen() {
  const router = useRouter();
  const { lang, t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">("terms");

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={
          activeTab === "terms"
            ? t.customer?.auth?.termsTitle || "الشروط والأحكام"
            : t.customer?.auth?.privacyTitle || "سياسة الخصوصية"
        }
        showBack
        onBack={() => router.back()}
      />

      <View
        style={[
          styles.tabsRow,
          { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === "terms" && styles.tabActive]}
          onPress={() => setActiveTab("terms")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "terms" && styles.tabTextActive,
            ]}
          >
            {t.customer?.auth?.termsTitle || "الشروط والأحكام"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "privacy" && styles.tabActive]}
          onPress={() => setActiveTab("privacy")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "privacy" && styles.tabTextActive,
            ]}
          >
            {t.customer?.auth?.privacyTitle || "سياسة الخصوصية"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.noticeCard}>
          <Text style={[styles.noticeText, { textAlign: isRTL ? "right" : "left" }]}>
            ℹ️ {lang === "ar"
              ? "ملاحظة: هذه مسودة أولية ونموذج تجريبي للشروط والخصوصية، ويخضع النص النهائي للاعتماد والمراجعة القانونية الشاملة قبل الإطلاق التجاري الرسمي."
              : "Note: This is an interim draft for terms and privacy, subject to formal legal review before commercial launch."}
          </Text>
        </Card>

        {activeTab === "terms" ? (
          <View style={styles.content}>
            <Text style={[styles.heading, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar" ? "1. الأهلية وسن الاستخدام (CUS-012)" : "1. Eligibility & Age (CUS-012)"}
            </Text>
            <Text style={[styles.paragraph, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar"
                ? "يشترط لاستخدام منصة محلات وإنشاء حساب أن يكون عمر المستخدم 18 سنة ميلادية كاملة على الأقل. باستخدامك للمنصة، فإنك تقر وتضمن التزامك بهذا الشرط القانوني."
                : "To use Mahallat and register an account, the user must be at least 18 years old. By using the platform, you confirm and warrant compliance with this legal requirement."}
            </Text>

            <Text style={[styles.heading, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar" ? "2. طبيعة الخدمات" : "2. Scope of Services"}
            </Text>
            <Text style={[styles.paragraph, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar"
                ? "منصة محلات توفر وسيطاً إلكترونياً للربط بين العملاء والمتاجر المستقلة ومقدمي خدمات التوصيل ونقل الركاب وفق الأنظمة المعمول بها في المملكة العربية السعودية."
                : "Mahallat provides a digital intermediary connecting customers with independent merchants and delivery providers under applicable laws of the Kingdom of Saudi Arabia."}
            </Text>

            <Text style={[styles.heading, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar" ? "3. الأسعار والمدفوعات" : "3. Pricing & Payments"}
            </Text>
            <Text style={[styles.paragraph, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar"
                ? "تُحسب جميع المبالغ بالريال السعودي وتشتمل على ضريبة القيمة المضافة النظامية المحددة. يتم الدفع عبر بوابات الدفع الإلكترونية المعتمدة من البنك المركزي السعودي."
                : "All amounts are calculated in SAR including statutory VAT. Payments are processed through approved payment gateways authorized by the Saudi Central Bank (SAMA)."}
            </Text>

            <Text style={[styles.heading, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar" ? "4. حذف الحساب وإسقاط الأرصدة (CUS-001)" : "4. Account Deletion (CUS-001)"}
            </Text>
            <Text style={[styles.paragraph, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar"
                ? "يحق للعميل طلب حذف حسابه في أي وقت. عند الحذف، يُعاد رصيد الاسترداد النقدي لوسيلة الدفع الأصلية، بينما يسقط الرصيد الترويجي والتعويض نهائياً."
                : "Users may request account deletion at any time. Cash refunds are returned to the payment method, while promotional and compensation balances are forfeited."}
            </Text>
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={[styles.heading, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar" ? "1. جمع البيانات الشخصية (REG-004)" : "1. Collection of Personal Data (REG-004)"}
            </Text>
            <Text style={[styles.paragraph, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar"
                ? "نلتزم بنظام حماية البيانات الشخصية السعودي. نجمع فقط البيانات اللازمة لتقديم الخدمة: رقم الجوال، الاسم، وإحداثيات الموقع الجغرافي لتوصيل الطلبات."
                : "We comply with the Saudi Personal Data Protection Law. We only collect data necessary for delivery: mobile number, name, and delivery location coordinates."}
            </Text>

            <Text style={[styles.heading, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar" ? "2. سجل الموافقات وسحبها" : "2. Consent Log & Revocation"}
            </Text>
            <Text style={[styles.paragraph, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar"
                ? "يتم توثيق كافة الموافقات الممنوحة من قبلك في سجل رقابي آمن. يحق لك سحب موافقتك على الرسائل التسويقية في أي وقت من خلال إعدادات حسابك."
                : "All consents are immutably logged. You may revoke marketing consent at any time via your account settings."}
            </Text>

            <Text style={[styles.heading, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar" ? "3. أمن البيانات ومشاركتها" : "3. Data Security & Sharing"}
            </Text>
            <Text style={[styles.paragraph, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar"
                ? "لا نقوم ببيع بياناتك الشخصية نهائياً. يتم تشفير كافة البيانات المخزنة والمنقولة عبر السحابة وفق أعلى معايير التشفير."
                : "We never sell your personal data. All stored and transmitted data is encrypted in accordance with industry best standards."}
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
    backgroundColor: "#F8FAFC",
  },
  tabsRow: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#0284C7",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#0284C7",
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  noticeCard: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    marginBottom: 20,
  },
  noticeText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 20,
  },
  content: {
    gap: 12,
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 8,
  },
  paragraph: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 22,
  },
});
