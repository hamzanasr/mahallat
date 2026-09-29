import React, { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { Header } from "../../components/ui/Header";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { maskSaudiPhone } from "@mahallat/shared";

export default function ProfileScreen() {
  const router = useRouter();
  const { lang, t, isRTL, toggleLanguage, setLanguage } = useLanguage();
  const {
    user,
    profile,
    isGuest,
    marketingConsent,
    setMarketingConsent,
    updateName,
    requestAccountDeletion,
    signOut,
  } = useCustomerAuth();

  // تعديل الاسم
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [updatingName, setUpdatingName] = useState(false);

  // حذف الحساب
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // فتح نافذة تعديل الاسم
  const handleOpenEditName = () => {
    setNewName(profile?.full_name || "");
    setShowEditNameModal(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setUpdatingName(true);
    const res = await updateName(newName);
    setUpdatingName(false);
    if (res.success) {
      setShowEditNameModal(false);
    } else {
      Alert.alert(t.common.error, res.error || "فشل تحديث الاسم");
    }
  };

  // تبديل موافقة التسويق
  const handleToggleMarketing = async (value: boolean) => {
    const res = await setMarketingConsent(value);
    if (!res.success) {
      Alert.alert(t.common.error, res.error || "فشل تحديث التفضيل");
    }
  };

  // تقديم طلب حذف الحساب
  const handleSubmitDelete = async () => {
    if (!deleteAcknowledged) {
      Alert.alert(
        t.common.error,
        t.customer?.profile?.deleteAcknowledge || "يجب الإقرار بسقوط الرصيد للمتابعة"
      );
      return;
    }

    setSubmittingDelete(true);
    const res = await requestAccountDeletion(deleteReason, deleteAcknowledged);
    setSubmittingDelete(false);

    if (res.success) {
      setDeleteSuccess(true);
    } else {
      Alert.alert(t.common.error, res.error || "فشل تقديم طلب الحذف");
    }
  };

  // تأكيد تسجيل الخروج
  const handleSignOut = () => {
    Alert.alert(
      t.customer?.profile?.logout || "تسجيل الخروج",
      t.customer?.profile?.logoutConfirm || "هل أنت متأكد من رغبتك في تسجيل الخروج؟",
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.customer?.profile?.logout || "خروج",
          style: "destructive",
          onPress: () => signOut(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={t.customer?.profile?.title || "حسابي"} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* حالة الزائر */}
        {isGuest ? (
          <Card style={styles.guestCard}>
            <View
              style={[
                styles.rowStart,
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
                      styles.profileName,
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
                    styles.profileDesc,
                    { textAlign: isRTL ? "right" : "left" },
                  ]}
                >
                  {t.customer?.profile?.loginPromptDesc ||
                    "سجل دخولك برقم جوالك لحفظ عناوينك ومتابعة طلباتك."}
                </Text>
              </View>
            </View>

            <Button
              title={t.customer?.profile?.loginButton || "تسجيل الدخول / إنشاء حساب"}
              onPress={() => router.push("/auth")}
              style={{ marginTop: 16 }}
            />
          </Card>
        ) : (
          /* حالة المستخدم المسجل */
          <Card style={styles.userCard}>
            <View
              style={[
                styles.rowStart,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <View style={styles.avatarCircleActive}>
                <Ionicons name="person" size={32} color="#FFFFFF" />
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
                      styles.profileName,
                      { textAlign: isRTL ? "right" : "left" },
                    ]}
                  >
                    {profile?.full_name || "عميل محلات"}
                  </Text>
                  <TouchableOpacity
                    onPress={handleOpenEditName}
                    style={styles.editNameButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#0284C7" />
                    <Text style={styles.editNameText}>
                      {t.customer?.profile?.editName || "تعديل"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* رقم الجوال مخفي جزئياً (مثل 05•• ••• 421) */}
                <Text
                  style={[
                    styles.phoneMasked,
                    { textAlign: isRTL ? "right" : "left" },
                  ]}
                >
                  {maskSaudiPhone(profile?.phone || user?.phone || "")}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* بطاقة العناوين المحفوظة (تجهيز للخطوة 2.3) */}
        {!isGuest && (
          <Card style={styles.sectionCard}>
            <TouchableOpacity
              style={[
                styles.settingRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
              onPress={() => router.push("/address")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.settingLabelGroup,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
                <Ionicons name="location-outline" size={22} color="#0284C7" />
                <View>
                  <Text style={styles.settingLabel}>
                    {t.customer?.profile?.addresses || "العناوين المحفوظة"}
                  </Text>
                  <Text style={styles.settingSublabel}>
                    {lang === "ar"
                      ? "إدارة عناوين التوصيل والتأكيد بالدبوس"
                      : "Manage delivery addresses and pin location"}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={isRTL ? "chevron-back" : "chevron-forward"}
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </Card>
        )}

        {/* بطاقة موافقة التسويق (CUS-001, REG-004) */}
        {!isGuest && (
          <Card style={styles.sectionCard}>
            <View
              style={[
                styles.settingRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.settingLabelGroup,
                  { flexDirection: isRTL ? "row-reverse" : "row", flex: 1 },
                ]}
              >
                <Ionicons name="notifications-outline" size={22} color="#0284C7" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>
                    {t.customer?.profile?.marketingConsentTitle ||
                      "الرسائل التسويقية والعروض"}
                  </Text>
                  <Text style={styles.settingSublabel}>
                    {t.customer?.profile?.marketingConsentDesc ||
                      "استلام إشعارات بالعروض الخاصة"}
                  </Text>
                </View>
              </View>
              <Switch
                value={marketingConsent}
                onValueChange={handleToggleMarketing}
                trackColor={{ false: "#CBD5E1", true: "#BAE6FD" }}
                thumbColor={marketingConsent ? "#0284C7" : "#F8FAFC"}
              />
            </View>
          </Card>
        )}

        {/* بطاقة الشروط والخصوصية */}
        <Card style={styles.sectionCard}>
          <TouchableOpacity
            style={[
              styles.settingRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
            onPress={() => router.push("/terms")}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.settingLabelGroup,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <Ionicons name="document-text-outline" size={22} color="#475569" />
              <Text style={styles.settingLabel}>
                {t.customer?.auth?.termsTitle || "الشروط والأحكام والخصوصية"}
              </Text>
            </View>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={20}
              color="#94A3B8"
            />
          </TouchableOpacity>
        </Card>

        {/* بطاقة اللغة والإعدادات */}
        <Card style={styles.sectionCard}>
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

          <Button
            title={
              lang === "ar"
                ? "Switch Language to English"
                : "التبديل إلى اللغة العربية"
            }
            onPress={toggleLanguage}
            variant="outline"
          />
        </Card>

        {/* خيارات الحساب للمسجلين: حذف الحساب وتسجيل الخروج */}
        {!isGuest && (
          <View style={{ gap: 12, marginTop: 8 }}>
            <Button
              title={t.customer?.profile?.logout || "تسجيل الخروج"}
              onPress={handleSignOut}
              variant="outline"
            />

            <TouchableOpacity
              onPress={() => {
                setDeleteAcknowledged(false);
                setDeleteReason("");
                setDeleteSuccess(false);
                setShowDeleteModal(true);
              }}
              style={styles.deleteButtonContainer}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteButtonText}>
                {t.customer?.profile?.deleteAccount || "حذف الحساب"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* تذييل التطبيق */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t.common.appName} · {t.customer?.profile?.appVersion || "الإصدار 1.0.0"}
          </Text>
        </View>
      </ScrollView>

      {/* نافذة تعديل الاسم */}
      <Modal
        visible={showEditNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text
              style={[
                styles.modalTitle,
                { textAlign: isRTL ? "right" : "left" },
              ]}
            >
              {t.customer?.profile?.editName || "تعديل الاسم"}
            </Text>

            <Input
              value={newName}
              onChangeText={setNewName}
              placeholder={t.customer?.auth?.fullNamePlaceholder || "الاسم الكامل"}
            />

            <View
              style={[
                styles.modalButtonsRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <Button
                title={t.common.save || "حفظ"}
                onPress={handleSaveName}
                loading={updatingName}
                style={{ flex: 1 }}
              />
              <Button
                title={t.common.cancel || "إلغاء"}
                onPress={() => setShowEditNameModal(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* نافذة طلب حذف الحساب (CUS-001) */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            {deleteSuccess ? (
              <View style={{ alignItems: "center", paddingVertical: 16 }}>
                <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
                <Text style={styles.deleteSuccessTitle}>
                  {t.customer?.profile?.deleteSuccess ||
                    "تم تسجيل طلبك بنجاح، وستتم مراجعته وإتمامه من قبل الإدارة"}
                </Text>
                <Button
                  title={t.customer?.ui?.close || "إغلاق"}
                  onPress={() => setShowDeleteModal(false)}
                  style={{ marginTop: 16, width: "100%" }}
                />
              </View>
            ) : (
              <>
                <View
                  style={[
                    styles.deleteModalHeader,
                    { flexDirection: isRTL ? "row-reverse" : "row" },
                  ]}
                >
                  <Ionicons name="warning" size={24} color="#DC2626" />
                  <Text style={styles.deleteModalTitle}>
                    {t.customer?.profile?.deleteWarningTitle || "تأكيد طلب حذف الحساب"}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.deleteModalDesc,
                    { textAlign: isRTL ? "right" : "left" },
                  ]}
                >
                  {t.customer?.profile?.deleteWarningDesc ||
                    "سيتم إلغاء حسابك وجميع بياناته. رصيد الاسترداد النقدي سيُعاد لوسيلة الدفع، بينما يسقط الرصيد الترويجي والتعويض نهائياً."}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.checkboxRow,
                    { flexDirection: isRTL ? "row-reverse" : "row" },
                  ]}
                  onPress={() => setDeleteAcknowledged(!deleteAcknowledged)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkbox,
                      deleteAcknowledged && styles.checkboxActiveDanger,
                    ]}
                  >
                    {deleteAcknowledged && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.checkboxLabelDanger,
                      { textAlign: isRTL ? "right" : "left" },
                    ]}
                  >
                    {t.customer?.profile?.deleteAcknowledge ||
                      "أقر بسقوط الرصيد الترويجي والتعويض ورغبتي بحذف الحساب نهائياً"}
                  </Text>
                </TouchableOpacity>

                <Input
                  value={deleteReason}
                  onChangeText={setDeleteReason}
                  placeholder={
                    t.customer?.profile?.deleteReasonPlaceholder ||
                    "سبب حذف الحساب (اختياري)"
                  }
                  containerStyle={{ marginTop: 12 }}
                />

                <View
                  style={[
                    styles.modalButtonsRow,
                    { flexDirection: isRTL ? "row-reverse" : "row" },
                  ]}
                >
                  <Button
                    title={t.customer?.profile?.submitDelete || "إرسال طلب الحذف"}
                    onPress={handleSubmitDelete}
                    variant="danger"
                    loading={submittingDelete}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title={t.common.cancel || "إلغاء"}
                    onPress={() => setShowDeleteModal(false)}
                    variant="outline"
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}
          </Card>
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
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  guestCard: {
    marginBottom: 16,
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
  },
  userCard: {
    marginBottom: 16,
  },
  sectionCard: {
    marginBottom: 16,
  },
  rowStart: {
    alignItems: "center",
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
  avatarCircleActive: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  profileName: {
    fontSize: 17,
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
  profileDesc: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  phoneMasked: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  editNameButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F0F9FF",
  },
  editNameText: {
    fontSize: 12,
    color: "#0284C7",
    fontWeight: "600",
  },
  settingRow: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLabelGroup: {
    alignItems: "center",
    gap: 10,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  settingSublabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
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
  deleteButtonContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  deleteButtonText: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    padding: 20,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 16,
  },
  modalButtonsRow: {
    gap: 10,
    marginTop: 12,
  },
  deleteModalHeader: {
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  deleteModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#DC2626",
  },
  deleteModalDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 16,
  },
  checkboxRow: {
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
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
  checkboxActiveDanger: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
  },
  checkboxLabelDanger: {
    flex: 1,
    fontSize: 13,
    color: "#991B1B",
    fontWeight: "600",
    lineHeight: 18,
  },
  deleteSuccessTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#16A34A",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
});
