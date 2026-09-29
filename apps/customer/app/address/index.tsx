import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { useAddress, CustomerAddress } from "../../context/AddressContext";
import { Header } from "../../components/ui/Header";
import { Button } from "../../components/ui/Button";

export default function AddressesScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { user } = useCustomerAuth();
  const {
    addresses,
    currentAddress,
    loading,
    setDefaultAddress,
    deleteAddress,
    setCurrentAddress,
  } = useAddress();

  const handleSetDefault = async (addr: CustomerAddress) => {
    const res = await setDefaultAddress(addr.id);
    if (!res.success) {
      Alert.alert("خطأ", res.error || "فشل تعيين العنوان كافتراضي");
    }
  };

  const handleDelete = (addr: CustomerAddress) => {
    Alert.alert(
      t("customer.address.deleteAddress"),
      t("customer.address.deleteConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            const res = await deleteAddress(addr.id);
            if (!res.success) {
              Alert.alert("خطأ", res.error || "فشل حذف العنوان");
            }
          },
        },
      ]
    );
  };

  const handleSelect = async (addr: CustomerAddress) => {
    await setCurrentAddress(addr);
    router.back();
  };

  const getPlaceIcon = (type: string) => {
    switch (type) {
      case "house":
        return "home-outline";
      case "apartment":
        return "business-outline";
      case "office":
        return "briefcase-outline";
      default:
        return "location-outline";
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title={t("customer.address.title")}
        showBack
        onBack={() => router.back()}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="location-outline" size={64} color="#94a3b8" />
          <Text style={styles.emptyTitle}>
            {t("customer.address.emptyAddresses")}
          </Text>
          <Text style={styles.emptyDesc}>
            {t("customer.address.emptyAddressesDesc")}
          </Text>
          <View style={{ width: "80%", marginTop: 20 }}>
            <Button
              title={t("customer.address.addAddress")}
              onPress={() => router.push("/address/new")}
              variant="primary"
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = currentAddress?.id === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.addressCard,
                  isSelected && styles.addressCardSelected,
                ]}
                onPress={() => handleSelect(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Ionicons
                      name={getPlaceIcon(item.type)}
                      size={20}
                      color="#2563eb"
                    />
                    <Text style={styles.addressName}>{item.name}</Text>
                    {item.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>افتراضي</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.addressDetails}>
                  {[item.district_name, item.street_name, item.building && `مبنى ${item.building}`]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>

                {item.short_national_address && (
                  <Text style={styles.nationalCode}>
                    العنوان الوطني: {item.short_national_address}
                  </Text>
                )}

                <View style={styles.cardFooter}>
                  {!item.is_default && (
                    <TouchableOpacity
                      onPress={() => handleSetDefault(item)}
                      style={styles.setDefaultBtn}
                    >
                      <Text style={styles.setDefaultText}>
                        {t("customer.address.isDefault")}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {isSelected && (
                    <View style={styles.activeTag}>
                      <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                      <Text style={styles.activeTagText}>العنوان المختار للتوصيل</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <View style={{ marginTop: 12 }}>
              <Button
                title={t("customer.address.addAddress")}
                onPress={() => router.push("/address/new")}
                variant="outline"
              />
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  addressCardSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addressName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0f172a",
  },
  defaultBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 11,
    color: "#1d4ed8",
    fontWeight: "600",
  },
  deleteBtn: {
    padding: 6,
  },
  addressDetails: {
    fontSize: 13,
    color: "#475569",
    marginTop: 4,
  },
  nationalCode: {
    fontSize: 11,
    color: "#0284c7",
    marginTop: 4,
    fontFamily: "monospace",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  setDefaultBtn: {
    paddingVertical: 4,
  },
  setDefaultText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "600",
  },
  activeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activeTagText: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "600",
  },
});
