import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  I18nManager,
  SafeAreaView,
  StatusBar,
} from "react-native";
import {
  SupportedLanguage,
  getTranslations,
  getDirection,
  isRTL as checkIsRTL,
} from "@mahallat/shared";

export default function HomeScreen() {
  // اللغة الافتراضية دائماً العربية بغض النظر عن لغة الجهاز
  const [lang, setLang] = useState<SupportedLanguage>("ar");

  const t = getTranslations(lang);
  const isRTL = checkIsRTL(lang);
  const dir = getDirection(lang);

  useEffect(() => {
    // تفعيل دعم RTL
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(isRTL);
    }
  }, [isRTL]);

  const toggleLanguage = () => {
    const nextLang: SupportedLanguage = lang === "ar" ? "en" : "ar";
    setLang(nextLang);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.container, { direction: dir }]}>
        <View style={styles.card}>
          <Text style={[styles.appName, { textAlign: isRTL ? "right" : "left" }]}>
            {t.common.appName}
          </Text>

          <Text style={[styles.tagline, { textAlign: isRTL ? "right" : "left" }]}>
            {t.common.tagline}
          </Text>

          <View style={styles.divider} />

          <Text style={[styles.welcome, { textAlign: isRTL ? "right" : "left" }]}>
            {t.home.welcome}
          </Text>

          <Text style={[styles.description, { textAlign: isRTL ? "right" : "left" }]}>
            {t.home.description}
          </Text>

          <View style={[styles.badge, { alignSelf: isRTL ? "flex-end" : "flex-start" }]}>
            <Text style={styles.badgeText}>{t.home.status}</Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={toggleLanguage}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{t.common.switchLanguage}</Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 16,
    color: "#64748B",
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginBottom: 16,
  },
  welcome: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 16,
  },
  badge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 24,
  },
  badgeText: {
    color: "#065F46",
    fontSize: 12,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
