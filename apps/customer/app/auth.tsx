import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../context/LanguageContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { Header } from "../components/ui/Header";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import {
  normalizeSaudiPhone,
  isValidSaudiPhone,
  formatLocalSaudiPhone,
} from "@mahallat/shared";

type AuthStep = "phone" | "otp" | "profile";

export default function AuthScreen() {
  const router = useRouter();
  const { t, isRTL, dir } = useLanguage();
  const { sendOtp, verifyOtp, completeProfile } = useCustomerAuth();

  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [ageAndTermsAgreed, setAgeAndTermsAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  // مؤقت إعادة إرسال الرمز
  useEffect(() => {
    let timer: any;
    if (step === "otp" && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // 1. إرسال رمز التحقق
  const handleSendOtp = async () => {
    setError(null);
    if (!isValidSaudiPhone(phone)) {
      setError(
        t.customer?.auth?.invalidPhone ||
          "يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05 ويتكون من 10 أرقام"
      );
      return;
    }

    setLoading(true);
    const res = await sendOtp(phone);
    setLoading(false);

    if (res.success) {
      setStep("otp");
      setCountdown(60);
    } else {
      setError(res.error || t.common.error);
    }
  };

  // 2. التحقق من الرمز
  const handleVerifyOtp = async () => {
    setError(null);
    if (otp.trim().length !== 6) {
      setError(
        t.customer?.auth?.invalidOtp ||
          "رمز التحقق غير صحيح، يجب أن يتكون من 6 أرقام"
      );
      return;
    }

    setLoading(true);
    const res = await verifyOtp(phone, otp);
    setLoading(false);

    if (res.success) {
      if (res.needsProfile) {
        setStep("profile");
      } else {
        router.back();
      }
    } else {
      setError(res.error || t.customer?.auth?.invalidOtp || "رمز غير صالح");
    }
  };

  // 3. إعادة إرسال الرمز
  const handleResend = async () => {
    if (countdown > 0) return;
    setError(null);
    setLoading(true);
    const res = await sendOtp(phone);
    setLoading(false);
    if (res.success) {
      setCountdown(60);
    } else {
      setError(res.error || t.common.error);
    }
  };

  // 4. إكمال التسجيل (CUS-012, REG-004)
  const handleCompleteProfile = async () => {
    setError(null);
    if (!fullName.trim()) {
      setError(t.customer?.auth?.fullNameRequired || "يرجى كتابة الاسم الكامل");
      return;
    }

    if (!ageAndTermsAgreed) {
      setError(
        t.customer?.auth?.termsAndAgeRequired ||
          "الموافقة على الشروط والإقرار بأن عمرك 18 سنة فأكثر إلزامية للمتابعة"
      );
      return;
    }

    setLoading(true);
    const res = await completeProfile(fullName, marketingAgreed);
    setLoading(false);

    if (res.success) {
      router.back();
    } else {
      setError(res.error || t.common.error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={
          step === "phone"
            ? t.customer?.auth?.signInOrRegister || "تسجيل الدخول"
            : step === "otp"
            ? t.customer?.auth?.otpTitle || "رمز التحقق"
            : t.customer?.auth?.completeProfileTitle || "إكمال البيانات"
        }
        showBack
        onBack={() => {
          if (step === "otp") setStep("phone");
          else router.back();
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          {error && (
            <ErrorMessage
              message={error}
              style={{ marginBottom: 16 }}
              onRetry={() => setError(null)}
              retryTitle={t.customer?.ui?.retry || "حسناً"}
            />
          )}

          {/* الخطوة 1: إدخال رقم الجوال */}
          {step === "phone" && (
            <Card style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="phone-portrait-outline" size={36} color="#0284C7" />
              </View>

              <Text
                style={[
                  styles.title,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t.customer?.auth?.signInOrRegister || "تسجيل الدخول أو إنشاء حساب"}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t.customer?.auth?.signInSubtitle ||
                  "أدخل رقم جوالك لتصلك رسالة نصية برمز التحقق"}
              </Text>

              <Input
                label={t.customer?.auth?.phoneLabel || "رقم الجوال"}
                placeholder={t.customer?.auth?.phonePlaceholder || "05xxxxxxxx"}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={14}
                helperText={t.customer?.auth?.phoneHint}
              />

              <Button
                title={t.customer?.auth?.sendCode || "إرسال رمز التحقق"}
                onPress={handleSendOtp}
                loading={loading}
                style={{ marginTop: 8 }}
              />
            </Card>
          )}

          {/* الخطوة 2: إدخال رمز التحقق OTP */}
          {step === "otp" && (
            <Card style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={36} color="#0284C7" />
              </View>

              <Text
                style={[
                  styles.title,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t.customer?.auth?.otpTitle || "رمز التحقق"}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t.customer?.auth?.otpSubtitle || "أدخل رمز التحقق المرسل إلى"}{" "}
                <Text style={{ fontWeight: "700", color: "#0F172A" }}>
                  {formatLocalSaudiPhone(phone)}
                </Text>
              </Text>

              <Input
                value={otp}
                onChangeText={setOtp}
                placeholder={t.customer?.auth?.otpPlaceholder || "000000"}
                keyboardType="number-pad"
                maxLength={6}
                inputStyle={styles.otpInput}
              />

              <Button
                title={t.customer?.auth?.verify || "تحقق ومتابعة"}
                onPress={handleVerifyOtp}
                loading={loading}
                style={{ marginTop: 8 }}
              />

              <View style={styles.resendContainer}>
                {countdown > 0 ? (
                  <Text style={styles.resendTimerText}>
                    {t.customer?.auth?.resendIn || "إعادة الإرسال خلال"}{" "}
                    {countdown} {t.customer?.auth?.seconds || "ثانية"}
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                    <Text style={styles.resendActiveText}>
                      {t.customer?.auth?.resendNow || "إعادة إرسال الرمز الآن"}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => setStep("phone")}
                  style={{ marginTop: 12 }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changePhoneText}>
                    {t.customer?.auth?.changePhone || "تعديل رقم الجوال"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* الخطوة 3: إكمال الملف الشخصي (CUS-012, REG-004) */}
          {step === "profile" && (
            <Card style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="person-add-outline" size={36} color="#0284C7" />
              </View>

              <Text
                style={[
                  styles.title,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t.customer?.auth?.completeProfileTitle || "إكمال البيانات"}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t.customer?.auth?.completeProfileSubtitle ||
                  "خطوة أخيرة لتجهيز حسابك وبدء الطلب"}
              </Text>

              <Input
                label={t.customer?.auth?.fullNameLabel || "الاسم الكامل"}
                placeholder={t.customer?.auth?.fullNamePlaceholder || "مثال: عبدالله محمد"}
                value={fullName}
                onChangeText={setFullName}
              />

              {/* مربع إلزامي: السن 18+ والشروط (CUS-012, REG-004) */}
              <TouchableOpacity
                style={[
                  styles.checkboxRow,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
                onPress={() => setAgeAndTermsAgreed(!ageAndTermsAgreed)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    ageAndTermsAgreed && styles.checkboxActive,
                  ]}
                >
                  {ageAndTermsAgreed && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.checkboxLabel,
                      { textAlign: isRTL ? "right" : "left" },
                    ]}
                  >
                    {t.customer?.auth?.termsAndAgeAgree ||
                      "أقر بأن عمري 18 سنة فأكثر، وأوافق على الشروط والأحكام وسياسة الخصوصية"}
                    {" "}
                    <Text
                      style={styles.legalLink}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push("/terms");
                      }}
                    >
                      (عرض الشروط)
                    </Text>
                  </Text>
                </View>
              </TouchableOpacity>

              {/* مربع اختياري: الرسائل التسويقية (CUS-001) */}
              <TouchableOpacity
                style={[
                  styles.checkboxRow,
                  { flexDirection: isRTL ? "row-reverse" : "row", marginTop: 8 },
                ]}
                onPress={() => setMarketingAgreed(!marketingAgreed)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    marketingAgreed && styles.checkboxActive,
                  ]}
                >
                  {marketingAgreed && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.checkboxLabel,
                      { textAlign: isRTL ? "right" : "left" },
                    ]}
                  >
                    {t.customer?.auth?.marketingAgree ||
                      "أوافق على استلام العروض والرسائل التسويقية (اختياري)"}
                  </Text>
                </View>
              </TouchableOpacity>

              <Button
                title={t.customer?.auth?.completeRegistration || "إتمام التسجيل والدخول"}
                onPress={handleCompleteProfile}
                loading={loading}
                style={{ marginTop: 20 }}
              />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    padding: 20,
    justifyContent: "center",
  },
  card: {
    padding: 24,
    borderRadius: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 20,
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: "700",
    textAlign: "center",
    height: 54,
  },
  resendContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  resendTimerText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  resendActiveText: {
    fontSize: 14,
    color: "#0284C7",
    fontWeight: "700",
  },
  changePhoneText: {
    fontSize: 13,
    color: "#64748B",
    textDecorationLine: "underline",
  },
  checkboxRow: {
    alignItems: "flex-start",
    gap: 12,
    marginVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: "#0284C7",
    borderColor: "#0284C7",
  },
  checkboxLabel: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
  },
  legalLink: {
    color: "#0284C7",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
