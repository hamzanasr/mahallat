import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { useAddress, CustomerAddress } from "../../context/AddressContext";
import { Button } from "../../components/ui/Button";

export default function SelectAddressModal() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useCustomerAuth();
  const {
    addresses,
    currentAddress,
    guestLocation,
    setCurrentAddress,
  } = useAddress();

  const handleSelect = async (addr: CustomerAddress) => {
    await setCurrentAddress(addr);
    router.back();
  };

  return (
    <SafeAreaView style={styles.modal}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("customer.address.chooseAddress")}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* إذا كان زائراً */}
      {!user ? (
        <View style={styles.guestContainer}>
          <View style={styles.currentGuestCard}>
            <Ionicons name="compass-outline" size={28} color="#2563eb" />
            <View style={{ flex: 1 }}>
              <Text style={styles.guestBadgeText}>
                {t("customer.address.guestLocationBadge")}
              </Text>
              <Text style={styles.guestLocLabel}>
                {guestLocation?.label || "جدة"}
              </Text>
            </View>
          </View>

          <Text style={styles.guestHelpText}>
            أنت تتصفح كزائر. يمكنك تغيير موقع التصفح على الخريطة أو تسجيل الدخول لحفظ عناوينك الدائمة.
          </Text>

          <Button
            title="تغيير موقع التصفح على الخريطة"
            onPress={() => {
              router.back();
              router.push("/address/new");
            }}
            variant="outline"
          />

          <View style={{ marginTop: 12 }}>
            <Button
              title="تسجيل الدخول / إنشاء حساب"
              onPress={() => {
                router.back();
                router.push("/auth");
              }}
              variant="primary"
            />
          </View>
        </View>
      ) : (
        /* للعميل المسجل */
        <View style={styles.listContainer}>
          <FlatList
            data={addresses}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = currentAddress?.id === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.itemCard,
                    isSelected && styles.itemCardSelected,
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <Ionicons
                    name={
                      item.type === "house"
                        ? "home"
                        : item.type === "apartment"
                        ? "business"
                        : "briefcase"
                    }
                    size={22}
                    color={isSelected ? "#2563eb" : "#64748b"}
                  />
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemSub}>
                      {[item.district_name, item.street_name].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#2563eb" />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>
                  {t("customer.address.emptyAddresses")}
                </Text>
              </View>
            }
          />

          <View style={styles.footer}>
            <Button
              title={t("customer.address.addAddress")}
              onPress={() => {
                router.back();
                router.push("/address/new");
              }}
              variant="primary"
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#0f172a",
  },
  closeBtn: {
    padding: 4,
  },
  guestContainer: {
    padding: 20,
  },
  currentGuestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f0f9ff",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bae6fd",
    marginBottom: 16,
  },
  guestBadgeText: {
    fontSize: 12,
    color: "#0284c7",
    fontWeight: "600",
  },
  guestLocLabel: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 2,
  },
  guestHelpText: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 20,
  },
  listContainer: {
    flex: 1,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  itemCardSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
  },
  itemSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  emptyWrap: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
});
