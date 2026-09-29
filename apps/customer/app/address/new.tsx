import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { useAddress, AddressFormData } from "../../context/AddressContext";
import { AddressMapPicker } from "../../components/AddressMapPicker";
import { isValidShortNationalAddress, normalizeShortNationalAddress } from "@mahallat/shared";
import { Header } from "../../components/ui/Header";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function NewAddressScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { user } = useCustomerAuth();
  const {
    checkLocationCoverage,
    saveAddress,
    setGuestLocation,
    submitCoverageRequest,
    lookupNationalAddress,
  } = useAddress();

  // الحالة
  const [step, setStep] = useState<"map" | "details">("map");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 21.5433,
    longitude: 39.1728, // جدة
  });
  const [pinConfirmedAt, setPinConfirmedAt] = useState<string | null>(null);
  const [isVerifyingCoverage, setIsVerifyingCoverage] = useState(false);
  const [isOutOfCoverage, setIsOutOfCoverage] = useState(false);
  const [coverageSent, setCoverageSent] = useState(false);

  // العنوان الوطني المختصر
  const [shortAddress, setShortAddress] = useState("");
  const [isLookingUpNational, setIsLookingUpNational] = useState(false);
  const [nationalAddressError, setNationalAddressError] = useState<string | null>(null);

  // تفاصيل العنوان (الخطوة 2)
  const [name, setName] = useState("");
  const [placeType, setPlaceType] = useState<"house" | "apartment" | "office" | "other">("house");
  const [district, setDistrict] = useState("");
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [entryInstructions, setEntryInstructions] = useState("");
  const [noAnswerInstructions, setNoAnswerInstructions] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. استعلام العنوان الوطني المختصر (CUS-002)
  const handleLookupShortAddress = async () => {
    setNationalAddressError(null);
    const clean = normalizeShortNationalAddress(shortAddress);

    if (!isValidShortNationalAddress(clean)) {
      setNationalAddressError(t("customer.address.invalidShortAddress"));
      return;
    }

    try {
      setIsLookingUpNational(true);
      const res = await lookupNationalAddress(clean);
      if (res.success && res.data) {
        const newCoords = {
          latitude: res.data.latitude,
          longitude: res.data.longitude,
        };
        setCoords(newCoords);
        if (res.data.district_name) setDistrict(res.data.district_name);
        if (res.data.street_name) setStreet(res.data.street_name);
        if (res.data.building_number) setBuilding(res.data.building_number);
        // إعادة ضبط تأكيد الدبوس لأن الموقع تغير
        setPinConfirmedAt(null);
      } else {
        setNationalAddressError(res.error || "تعذر العثور على العنوان الوطني المختصر");
      }
    } finally {
      setIsLookingUpNational(false);
    }
  };

  // 2. تأكيد موقع الدبوس على الخريطة (إلزامي CUS-002)
  const handleConfirmPin = async () => {
    setIsVerifyingCoverage(true);
    setIsOutOfCoverage(false);

    try {
      const cov = await checkLocationCoverage(coords.latitude, coords.longitude);
      if (!cov.covered) {
        setIsOutOfCoverage(true);
        return;
      }

      // توثيق لحظة التأكيد
      const confirmedTime = new Date().toISOString();
      setPinConfirmedAt(confirmedTime);

      // إذا كان المستخدم زائراً، يمكنه التصفح بهذا الموقع مباشرة
      if (!user) {
        await setGuestLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: district || "جدة",
          cityName: cov.city?.name_ar,
          cityId: cov.city?.id,
          districtName: district,
        });
        Alert.alert(
          t("customer.address.pinConfirmed"),
          "تم حفظ موقعك المؤقت للتصفح بنجاح!",
          [{ text: "حسناً", onPress: () => router.back() }]
        );
        return;
      }

      // إذا كان مسجلاً ينتقل لملء بيانات العنوان
      setStep("details");
    } finally {
      setIsVerifyingCoverage(false);
    }
  };

  // 3. إرسال طلب التغطية (ADM-033)
  const handleNotifyCoverage = async () => {
    try {
      const res = await submitCoverageRequest(
        coords.latitude,
        coords.longitude,
        district || undefined,
        undefined,
        "طلب من شاشة خارج التغطية بتطبيق العميل"
      );
      if (res.success) {
        setCoverageSent(true);
      } else {
        Alert.alert("تنبيه", res.error || "حدث خطأ أثناء إرسال طلب التغطية");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 4. حفظ العنوان الكامل
  const handleSaveAddress = async () => {
    if (!name.trim()) {
      Alert.alert("تنبيه", "يرجى كتابة اسم للعنوان (مثل: منزلي)");
      return;
    }

    if (!pinConfirmedAt) {
      Alert.alert("تنبيه", t("customer.address.pinMustConfirm"));
      setStep("map");
      return;
    }

    try {
      setIsSaving(true);
      const payload: AddressFormData = {
        name: name.trim(),
        type: placeType,
        latitude: coords.latitude,
        longitude: coords.longitude,
        pin_confirmed_at: pinConfirmedAt,
        district_name: district.trim() || undefined,
        street_name: street.trim() || undefined,
        building: building.trim() || undefined,
        floor: floor.trim() || undefined,
        apartment: apartment.trim() || undefined,
        entry_instructions: entryInstructions.trim() || undefined,
        no_answer_instructions: noAnswerInstructions.trim() || undefined,
        short_national_address: shortAddress.trim() || undefined,
        is_default: isDefault,
      };

      const res = await saveAddress(payload);
      if (res.success) {
        Alert.alert(t("common.success"), "تم حفظ العنوان بنجاح", [
          { text: "حسناً", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("خطأ", res.error || "فشل حفظ العنوان");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header
        title={
          step === "map"
            ? t("customer.address.selectLocation")
            : t("customer.address.addressDetails")
        }
        showBack
        onBack={() => {
          if (step === "details") {
            setStep("map");
          } else {
            router.back();
          }
        }}
      />

      {step === "map" ? (
        <View style={styles.mapContainer}>
          {/* شريط البحث بالعنوان الوطني المختصر (CUS-002) */}
          <View style={styles.nationalAddressBar}>
            <View style={styles.inputWrap}>
              <Ionicons name="search-outline" size={18} color="#64748b" />
              <TextInput
                style={[styles.shortInput, { textAlign: isRTL ? "right" : "left" }]}
                placeholder={t("customer.address.shortNationalAddressPlaceholder")}
                value={shortAddress}
                onChangeText={(text) => {
                  setShortAddress(text);
                  setNationalAddressError(null);
                }}
                maxLength={8}
                autoCapitalize="characters"
              />
              {isLookingUpNational ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <TouchableOpacity
                  onPress={handleLookupShortAddress}
                  style={styles.searchBtn}
                >
                  <Text style={styles.searchBtnText}>
                    {t("customer.address.searchShortAddress")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {nationalAddressError && (
              <Text style={styles.errorText}>{nationalAddressError}</Text>
            )}
          </View>

          {/* الخريطة مع الدبوس الثابت بالوسط */}
          <AddressMapPicker
            initialCoordinates={coords}
            onCoordinatesChange={(newCoords) => {
              setCoords(newCoords);
              setPinConfirmedAt(null);
              setIsOutOfCoverage(false);
            }}
            isPinConfirmed={!!pinConfirmedAt}
          />

          {/* حالة «خارج التغطية» بخطوة واحدة زر «أبلغوني» (ADM-033) */}
          {isOutOfCoverage ? (
            <View style={styles.outOfCoverageCard}>
              <View style={styles.outOfCoverageHeader}>
                <Ionicons name="alert-circle" size={28} color="#ea580c" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.outOfCoverageTitle}>
                    {t("customer.address.outOfCoverageTitle")}
                  </Text>
                  <Text style={styles.outOfCoverageDesc}>
                    {t("customer.address.outOfCoverageDesc")}
                  </Text>
                </View>
              </View>

              {coverageSent ? (
                <View style={styles.coverageSentBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  <Text style={styles.coverageSentText}>
                    {t("customer.address.requestSent")}
                  </Text>
                </View>
              ) : (
                <Button
                  title={t("customer.address.notifyMe")}
                  onPress={handleNotifyCoverage}
                  variant="primary"
                />
              )}
            </View>
          ) : (
            /* لوحة تأكيد الموقع بالأسفل */
            <View style={styles.bottomCard}>
              <Text style={styles.confirmInstruction}>
                حرّك الخريطة لجعل الدبوس على مبناك مباشرة ثم اضغط تأكيد:
              </Text>
              <Button
                title={t("customer.address.confirmPin")}
                onPress={handleConfirmPin}
                loading={isVerifyingCoverage}
                variant="primary"
              />
            </View>
          )}
        </View>
      ) : (
        /* الخطوة 2: ملء بيانات وتفاصيل العنوان */
        <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
          <Input
            label={t("customer.address.addressNameLabel")}
            placeholder={t("customer.address.addressNamePlaceholder")}
            value={name}
            onChangeText={setName}
          />

          {/* خيارات نوع المكان */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("customer.address.typeLabel")}</Text>
            <View style={styles.typeChips}>
              {[
                { key: "house", label: t("customer.address.typeHouse"), icon: "home" },
                { key: "apartment", label: t("customer.address.typeApartment"), icon: "business" },
                { key: "office", label: t("customer.address.typeOffice"), icon: "briefcase" },
                { key: "other", label: t("customer.address.typeOther"), icon: "pin" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.chip,
                    placeType === item.key && styles.chipActive,
                  ]}
                  onPress={() => setPlaceType(item.key as any)}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={16}
                    color={placeType === item.key ? "#fff" : "#475569"}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      placeType === item.key && styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label={t("customer.address.districtLabel")}
            placeholder="مثال: الروضة"
            value={district}
            onChangeText={setDistrict}
          />

          <Input
            label={t("customer.address.streetLabel")}
            placeholder="مثال: شارع الكيال"
            value={street}
            onChangeText={setStreet}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input
                label={t("customer.address.buildingLabel")}
                placeholder="رقم المبنى"
                value={building}
                onChangeText={setBuilding}
              />
            </View>
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Input
                label={t("customer.address.floorLabel")}
                placeholder="الدور"
                value={floor}
                onChangeText={setFloor}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t("customer.address.apartmentLabel")}
                placeholder="الشقة"
                value={apartment}
                onChangeText={setApartment}
              />
            </View>
          </View>

          <Input
            label={t("customer.address.entryInstructionsLabel")}
            placeholder={t("customer.address.entryInstructionsPlaceholder")}
            value={entryInstructions}
            onChangeText={setEntryInstructions}
          />

          <Input
            label={t("customer.address.noAnswerInstructionsLabel")}
            placeholder={t("customer.address.noAnswerInstructionsPlaceholder")}
            value={noAnswerInstructions}
            onChangeText={setNoAnswerInstructions}
          />

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsDefault(!isDefault)}
          >
            <Ionicons
              name={isDefault ? "checkbox" : "square-outline"}
              size={22}
              color={isDefault ? "#2563eb" : "#94a3b8"}
            />
            <Text style={styles.checkboxLabel}>
              {t("customer.address.isDefault")}
            </Text>
          </TouchableOpacity>

          <Button
            title={t("customer.address.saveAddress")}
            onPress={handleSaveAddress}
            loading={isSaving}
            variant="primary"
          />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  nationalAddressBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  shortInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    marginHorizontal: 8,
    paddingVertical: 4,
  },
  searchBtn: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  searchBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#2563eb",
  },
  errorText: {
    fontSize: 11,
    color: "#dc2626",
    marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  bottomCard: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmInstruction: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 12,
    textAlign: "center",
  },
  outOfCoverageCard: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#fdba74",
  },
  outOfCoverageHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  outOfCoverageTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#9a3412",
  },
  outOfCoverageDesc: {
    fontSize: 12,
    color: "#7c2d12",
    marginTop: 2,
  },
  coverageSentBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  coverageSentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16a34a",
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    gap: 12,
  },
  fieldGroup: {
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  typeChips: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
  },
  chipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  chipText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  row: {
    flexDirection: "row",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 8,
  },
  checkboxLabel: {
    fontSize: 13,
    color: "#1e293b",
  },
});
