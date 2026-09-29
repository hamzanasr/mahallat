import React from "react";
import { SafeAreaView, StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { Header } from "../../components/ui/Header";

export default function TaxiScreen() {
  const { t, isRTL } = useLanguage();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={t.customer?.taxi?.title || "Taxi"} />
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="car-sport" size={48} color="#CA8A04" />
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {t.customer?.taxi?.badge || "قريباً"}
          </Text>
        </View>

        <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>
          {t.customer?.taxi?.comingSoonTitle || "خدمة التاكسي قريباً"}
        </Text>

        <Text style={styles.description}>
          {t.customer?.taxi?.comingSoonDescription ||
            "نعمل على تجهيز أسطول التاكسي لتوفير رحلات وتوصيل موثوق عبر تطبيق محلات."}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FEF08A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  badge: {
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FDE047",
    marginBottom: 16,
  },
  badgeText: {
    color: "#854D0E",
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
});
