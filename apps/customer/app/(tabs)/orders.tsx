import React from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import { Header } from "../../components/ui/Header";
import { EmptyState } from "../../components/ui/EmptyState";

export default function OrdersScreen() {
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={t.customer?.orders?.title || "الطلبات"} />
      <View style={styles.container}>
        <EmptyState
          iconName="receipt-outline"
          title={t.customer?.orders?.emptyTitle || "لا توجد طلبات بعد"}
          description={
            t.customer?.orders?.emptyDescription ||
            "عندما تقوم بالطلب، ستظهر طلباتك الحالية والسابقة هنا لتتبعها خطوة بخطوة."
          }
        />
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
    padding: 20,
  },
});
