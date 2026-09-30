import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../context/LanguageContext";
import { useDriverAuth } from "../context/DriverAuthContext";

export default function DriverLoginScreen() {
  const router = useRouter();
  const { lang } = useLanguage();
  const { sendOtp, verifyOtp } = useDriverAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  // حساب تجريبي سريع للتطوير
  const setDemoDriver = (num: string) => {
    setPhone(num);
  };

  const handleSendOtp = async () => {
    if (!phone || phone.length < 9) {
      Alert.alert(lang === "ar" ? "تنبيه" : "Notice", lang === "ar" ? "يرجى إدخال رقم جوال سعودي صحيح" : "Please enter a valid Saudi phone number");
      return;
    }
    setLoading(true);
    const res = await sendOtp(phone);
    setLoading(false);
    if (res.success) {
      setStep("otp");
    } else {
      Alert.alert(lang === "ar" ? "فشل الإرسال" : "Error", res.error || "فشل إرسال رمز التحقق");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert(lang === "ar" ? "تنبيه" : "Notice", lang === "ar" ? "أدخل رمز التحقق المكون من 6 أرقام" : "Enter 6-digit verification code");
      return;
    }
    setLoading(true);
    const res = await verifyOtp(phone, otp);
    setLoading(false);
    if (res.success) {
      router.replace("/(tabs)");
    } else {
      Alert.alert(lang === "ar" ? "خطأ" : "Error", res.error || "رمز التحقق غير صحيح");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="bicycle" size={40} color="#10B981" />
            </View>
            <Text style={styles.title}>
              {lang === "ar" ? "دخول كابتن محلات" : "Mahallat Driver Login"}
            </Text>
            <Text style={styles.subtitle}>
              {step === "phone"
                ? (lang === "ar" ? "أدخل رقم جوالك لتصلك رسالة الدخول" : "Enter your phone to receive OTP")
                : (lang === "ar" ? `أدخل الرمز المرسل إلى ${phone}` : `Enter the OTP sent to ${phone}`)}
            </Text>
          </View>

          {step === "phone" ? (
            <View style={styles.form}>
              <Text style={styles.inputLabel}>{lang === "ar" ? "رقم الجوال" : "Phone Number"}</Text>
              <View style={styles.phoneInputRow}>
                <Text style={styles.countryCode}>+966</Text>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="05XXXXXXXX"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={10}
                />
              </View>

              {/* أزرار التجربة السريعة */}
              <View style={styles.demoBox}>
                <Text style={styles.demoTitle}>{lang === "ar" ? "حسابات تجريبية سريعة:" : "Quick Demo Accounts:"}</Text>
                <View style={styles.demoBtnsRow}>
                  <TouchableOpacity
                    style={styles.demoBtn}
                    onPress={() => setDemoDriver("0551111111")}
                  >
                    <Text style={styles.demoBtnText}>كابتن أحمد (سيارة موثق)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.demoBtn}
                    onPress={() => setDemoDriver("0552222222")}
                  >
                    <Text style={styles.demoBtnText}>كابتن فيصل (دراجة)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>{lang === "ar" ? "إرسال الرمز" : "Send OTP"}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.inputLabel}>{lang === "ar" ? "رمز التحقق (SMS)" : "Verification Code"}</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="123456"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={6}
                autoFocus
              />

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>{lang === "ar" ? "تأكيد والدخول" : "Verify & Sign In"}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.changePhoneBtn}
                onPress={() => setStep("phone")}
              >
                <Text style={styles.changePhoneText}>
                  {lang === "ar" ? "تغيير رقم الجوال" : "Change phone number"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    padding: 24,
    flexGrow: 1,
  },
  backBtn: {
    alignSelf: "flex-start",
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    marginBottom: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  form: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: "#F9FAFB",
  },
  countryCode: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginRight: 10,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  otpInput: {
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 8,
    backgroundColor: "#F9FAFB",
  },
  demoBox: {
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 8,
  },
  demoBtnsRow: {
    gap: 6,
  },
  demoBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  demoBtnText: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "600",
  },
  primaryBtn: {
    backgroundColor: "#10B981",
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  changePhoneBtn: {
    alignItems: "center",
    marginTop: 8,
  },
  changePhoneText: {
    color: "#6B7280",
    fontSize: 14,
  },
});
