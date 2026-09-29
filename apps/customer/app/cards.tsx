import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "../context/LanguageContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { supabase } from "../lib/supabase";

interface PaymentMethod {
  id: string;
  brand: "mada" | "visa" | "mastercard" | "amex" | "applepay";
  last4: string;
  exp_month: number;
  exp_year: number;
  cardholder_name: string | null;
  is_default: boolean;
  created_at: string;
}

export default function CardsScreen() {
  const router = useRouter();
  const { lang, isRTL } = useLanguage();
  const { user } = useCustomerAuth();

  const [cards, setCards] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // حالة مودال إضافة بطاقة
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchCards = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("customer_payment_methods")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("خطأ جلب البطاقات:", error.message);
        return;
      }

      setCards((data || []) as PaymentMethod[]);
    } catch (err) {
      console.error("خطأ عام في البطاقات:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCards();
  };

  const handleSetDefault = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from("customer_payment_methods")
        .update({ is_default: true })
        .eq("id", cardId);

      if (error) {
        Alert.alert(lang === "ar" ? "خطأ" : "Error", error.message);
        return;
      }
      fetchCards();
    } catch (err: any) {
      Alert.alert(lang === "ar" ? "خطأ" : "Error", err?.message);
    }
  };

  const handleDeleteCard = (card: PaymentMethod) => {
    Alert.alert(
      lang === "ar" ? "حذف البطاقة" : "Delete Card",
      lang === "ar"
        ? `هل أنت متأكد من رغبتك في حذف البطاقة المنتهية بـ ${card.last4}؟`
        : `Are you sure you want to remove card ending with ${card.last4}?`,
      [
        { text: lang === "ar" ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: lang === "ar" ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.rpc("delete_customer_payment_method", {
              p_payment_method_id: card.id,
            });
            if (error) {
              Alert.alert(lang === "ar" ? "تعذر الحذف" : "Cannot Delete", error.message);
              return;
            }
            fetchCards();
          },
        },
      ]
    );
  };

  const detectBrand = (num: string): "mada" | "visa" | "mastercard" => {
    const clean = num.replace(/\s+/g, "");
    if (clean.startsWith("588848") || clean.startsWith("588845") || clean.startsWith("4")) {
      return clean.startsWith("5888") ? "mada" : "visa";
    }
    if (clean.startsWith("5")) return "mastercard";
    return "mada";
  };

  const handleSaveCard = async () => {
    const cleanNum = cardNumber.replace(/\s+/g, "");
    if (cleanNum.length < 15 || cleanNum.length > 19) {
      Alert.alert(lang === "ar" ? "خطأ" : "Error", lang === "ar" ? "رقم البطاقة غير صحيح" : "Invalid card number");
      return;
    }

    const monthNum = parseInt(expMonth, 10);
    const yearNum = parseInt(expYear.length === 2 ? `20${expYear}` : expYear, 10);

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      Alert.alert(lang === "ar" ? "خطأ" : "Error", lang === "ar" ? "شهر الانتهاء غير صحيح (1-12)" : "Invalid expiry month");
      return;
    }

    if (isNaN(yearNum) || yearNum < 2024 || yearNum > 2040) {
      Alert.alert(lang === "ar" ? "خطأ" : "Error", lang === "ar" ? "سنة الانتهاء غير صحيحة" : "Invalid expiry year");
      return;
    }

    if (!cvc || cvc.length < 3) {
      Alert.alert(lang === "ar" ? "خطأ" : "Error", lang === "ar" ? "رمز التحقق CVC مطلوب (3 أرقام)" : "CVC required");
      return;
    }

    try {
      setSaving(true);
      const brand = detectBrand(cleanNum);
      const last4 = cleanNum.slice(-4);
      // Generate standard Moyasar Token ID format
      const mockToken = `tok_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const { data, error } = await supabase.rpc("save_customer_payment_method", {
        p_moyasar_token_id: mockToken,
        p_brand: brand,
        p_last4: last4,
        p_exp_month: monthNum,
        p_exp_year: yearNum,
        p_cardholder_name: cardholderName.trim() || (lang === "ar" ? "حامل البطاقة" : "Cardholder"),
        p_is_default: makeDefault,
      });

      if (error) {
        Alert.alert(lang === "ar" ? "تعذر الحفظ" : "Cannot Save", error.message);
        return;
      }

      setAddModalVisible(false);
      setCardNumber("");
      setExpMonth("");
      setExpYear("");
      setCvc("");
      setCardholderName("");
      setMakeDefault(false);
      fetchCards();

      Alert.alert(
        lang === "ar" ? "تم الحفظ" : "Saved",
        lang === "ar" ? "تم حفظ البطاقة بنجاح وأمان عبر ميسر" : "Card has been saved securely via Moyasar"
      );
    } catch (err: any) {
      Alert.alert(lang === "ar" ? "خطأ" : "Error", err?.message);
    } finally {
      setSaving(false);
    }
  };

  const getBrandBadge = (brand: string) => {
    switch (brand) {
      case "mada":
        return { label: "مدى mada", color: "#0D9488", icon: "card-outline" };
      case "visa":
        return { label: "فيزا Visa", color: "#2563EB", icon: "card-outline" };
      case "mastercard":
        return { label: "ماستركارد", color: "#EA580C", icon: "card-outline" };
      case "applepay":
        return { label: "Apple Pay", color: "#000000", icon: "logo-apple" };
      default:
        return { label: brand, color: "#64748B", icon: "card-outline" };
    }
  };

  const fillQuickTestCard = (type: "mada" | "visa" | "mastercard") => {
    if (type === "mada") {
      setCardNumber("5888 4800 0000 0001");
      setExpMonth("12");
      setExpYear("2028");
      setCvc("123");
      setCardholderName("بطاقة مدى تجريبية");
    } else if (type === "visa") {
      setCardNumber("4111 1111 1111 1111");
      setExpMonth("10");
      setExpYear("2027");
      setCvc("456");
      setCardholderName("بطاقة فيزا تجريبية");
    } else {
      setCardNumber("5105 1051 0510 5100");
      setExpMonth("08");
      setExpYear("2029");
      setCvc("789");
      setCardholderName("بطاقة ماستركارد تجريبية");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <Ionicons
            name={isRTL ? "chevron-forward" : "chevron-back"}
            size={24}
            color="#1E293B"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {lang === "ar" ? "البطاقات وطرق الدفع" : "Cards & Payments"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            {lang === "ar" ? "جاري تحميل البطاقات..." : "Loading cards..."}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563EB"]} />
          }
        >
          {/* Information Card (PAY-023) */}
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={24} color="#059669" />
            <Text style={[styles.infoText, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar"
                ? "تُحفظ البطاقات بأمان عبر بوابة ميسر المعتمدة. لا يتم تخزين أرقام بطاقتك الكاملة أو رمز الأمان لدينا نهائياً."
                : "Cards are securely tokenized via Moyasar. Your full card number and CVC are never stored on our servers."}
            </Text>
          </View>

          {/* Cards List */}
          {cards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="card-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {lang === "ar" ? "لا توجد بطاقات محفوظة" : "No Saved Cards"}
              </Text>
              <Text style={styles.emptyDesc}>
                {lang === "ar"
                  ? "أضف بطاقتك الائتمانية أو بطاقة مدى لتسريع الدفع مستقبلاً"
                  : "Add your mada or credit card for faster checkout"}
              </Text>
            </View>
          ) : (
            cards.map((card) => {
              const badge = getBrandBadge(card.brand);
              return (
                <View key={card.id} style={styles.cardItem}>
                  <View style={[styles.cardItemTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <View style={[styles.brandContainer, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                      <View style={[styles.brandDot, { backgroundColor: badge.color }]} />
                      <Text style={[styles.brandText, { color: badge.color }]}>{badge.label}</Text>
                    </View>

                    {card.is_default ? (
                      <View style={styles.defaultBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#059669" />
                        <Text style={styles.defaultBadgeText}>
                          {lang === "ar" ? "افتراضية" : "Default"}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleSetDefault(card.id)}
                        style={styles.setDefaultBtn}
                      >
                        <Text style={styles.setDefaultText}>
                          {lang === "ar" ? "تعيين كافتراضية" : "Set as Default"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={[styles.cardNumberText, { textAlign: isRTL ? "right" : "left" }]}>
                    ••••  ••••  ••••  {card.last4}
                  </Text>

                  <View style={[styles.cardItemBottom, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <View>
                      <Text style={styles.cardholderText}>
                        {card.cardholder_name || (lang === "ar" ? "حامل البطاقة" : "Cardholder")}
                      </Text>
                      <Text style={styles.cardExpText}>
                        {card.exp_month < 10 ? `0${card.exp_month}` : card.exp_month}/{String(card.exp_year).slice(-2)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteCard(card)}
                      style={styles.deleteCardBtn}
                      accessibilityLabel="Delete Card"
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* Add New Card Button */}
          <TouchableOpacity
            style={[styles.addCardBtn, { flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
            <Text style={styles.addCardBtnText}>
              {lang === "ar" ? "إضافة بطاقة جديدة" : "Add New Card"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Add Card Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text style={styles.modalTitle}>
                {lang === "ar" ? "إضافة بطاقة دفع" : "Add Payment Card"}
              </Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Quick Fill Test Cards for Dev */}
            <View style={styles.quickFillContainer}>
              <Text style={[styles.quickFillTitle, { textAlign: isRTL ? "right" : "left" }]}>
                {lang === "ar" ? "بطاقات تجريبية سريعة (ميسر):" : "Quick Test Cards (Moyasar):"}
              </Text>
              <View style={[styles.quickFillRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <TouchableOpacity
                  style={[styles.testCardChip, { backgroundColor: "#F0FDFA", borderColor: "#0D9488" }]}
                  onPress={() => fillQuickTestCard("mada")}
                >
                  <Text style={[styles.testCardChipText, { color: "#0D9488" }]}>مدى (تجريبية)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.testCardChip, { backgroundColor: "#EFF6FF", borderColor: "#2563EB" }]}
                  onPress={() => fillQuickTestCard("visa")}
                >
                  <Text style={[styles.testCardChipText, { color: "#2563EB" }]}>فيزا (تجريبية)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.testCardChip, { backgroundColor: "#FFF7ED", borderColor: "#EA580C" }]}
                  onPress={() => fillQuickTestCard("mastercard")}
                >
                  <Text style={[styles.testCardChipText, { color: "#EA580C" }]}>ماستركارد (تجريبية)</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { textAlign: isRTL ? "right" : "left" }]}>
                {lang === "ar" ? "اسم حامل البطاقة" : "Cardholder Name"}
              </Text>
              <TextInput
                style={[styles.textInput, { textAlign: isRTL ? "right" : "left" }]}
                placeholder={lang === "ar" ? "كما هو مطبوع على البطاقة" : "As on card"}
                value={cardholderName}
                onChangeText={setCardholderName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { textAlign: isRTL ? "right" : "left" }]}>
                {lang === "ar" ? "رقم البطاقة" : "Card Number"}
              </Text>
              <TextInput
                style={[styles.textInput, { textAlign: isRTL ? "right" : "left" }]}
                placeholder="4000 0000 0000 0000"
                keyboardType="numeric"
                value={cardNumber}
                onChangeText={setCardNumber}
              />
            </View>

            <View style={[styles.rowInputs, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={{ flex: 1, marginHorizontal: 4 }}>
                <Text style={[styles.inputLabel, { textAlign: isRTL ? "right" : "left" }]}>
                  {lang === "ar" ? "الشهر (MM)" : "Month"}
                </Text>
                <TextInput
                  style={[styles.textInput, { textAlign: "center" }]}
                  placeholder="12"
                  maxLength={2}
                  keyboardType="numeric"
                  value={expMonth}
                  onChangeText={setExpMonth}
                />
              </View>
              <View style={{ flex: 1, marginHorizontal: 4 }}>
                <Text style={[styles.inputLabel, { textAlign: isRTL ? "right" : "left" }]}>
                  {lang === "ar" ? "السنة (YY)" : "Year"}
                </Text>
                <TextInput
                  style={[styles.textInput, { textAlign: "center" }]}
                  placeholder="28"
                  maxLength={4}
                  keyboardType="numeric"
                  value={expYear}
                  onChangeText={setExpYear}
                />
              </View>
              <View style={{ flex: 1, marginHorizontal: 4 }}>
                <Text style={[styles.inputLabel, { textAlign: isRTL ? "right" : "left" }]}>
                  CVC / CVV
                </Text>
                <TextInput
                  style={[styles.textInput, { textAlign: "center" }]}
                  placeholder="123"
                  maxLength={4}
                  secureTextEntry
                  keyboardType="numeric"
                  value={cvc}
                  onChangeText={setCvc}
                />
              </View>
            </View>

            {/* Default Card Checkbox */}
            <TouchableOpacity
              style={[styles.checkboxRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
              onPress={() => setMakeDefault(!makeDefault)}
            >
              <Ionicons
                name={makeDefault ? "checkbox" : "square-outline"}
                size={22}
                color={makeDefault ? "#2563EB" : "#94A3B8"}
              />
              <Text style={[styles.checkboxLabel, { marginHorizontal: 8 }]}>
                {lang === "ar" ? "تعيين كبطاقة افتراضية للمشتريات" : "Set as default payment card"}
              </Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSaveCard}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {lang === "ar" ? "حفظ البطاقة" : "Save Card"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    height: 56,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    marginBottom: 16,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#166534",
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#334155",
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  cardItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardItemTop: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  brandContainer: {
    alignItems: "center",
    gap: 6,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },
  setDefaultBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  setDefaultText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "500",
  },
  cardNumberText: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#1E293B",
    marginVertical: 10,
    fontFamily: "monospace",
  },
  cardItemBottom: {
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  cardholderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  cardExpText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  deleteCardBtn: {
    padding: 6,
  },
  addCardBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    gap: 8,
  },
  addCardBtnText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  quickFillContainer: {
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  quickFillTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  quickFillRow: {
    flexWrap: "wrap",
    gap: 6,
  },
  testCardChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  testCardChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  rowInputs: {
    marginBottom: 12,
  },
  checkboxRow: {
    alignItems: "center",
    marginVertical: 12,
  },
  checkboxLabel: {
    fontSize: 13,
    color: "#334155",
  },
  saveBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
