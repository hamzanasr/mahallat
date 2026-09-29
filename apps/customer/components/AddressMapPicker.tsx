import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../context/LanguageContext";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface AddressMapPickerProps {
  initialCoordinates?: Coordinates;
  onCoordinatesChange: (coords: Coordinates) => void;
  isPinConfirmed: boolean;
}

// مركز مدينة جدة الافتراضي عند رفض الإذن أو عدم التوفر
const JEDDAH_CENTER: Coordinates = {
  latitude: 21.5433,
  longitude: 39.1728,
};

export function AddressMapPicker({
  initialCoordinates = JEDDAH_CENTER,
  onCoordinatesChange,
  isPinConfirmed,
}: AddressMapPickerProps) {
  const { t, isRTL } = useLanguage();
  const [coords, setCoords] = useState<Coordinates>(initialCoordinates);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [locating, setLocating] = useState(false);

  // طلب إذن الموقع عند الفتح لأول مرة (CUS-002)
  useEffect(() => {
    async function requestUserLocation() {
      try {
        setLocating(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setPermissionDenied(true);
          setLocating(false);
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const newCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoords(newCoords);
        onCoordinatesChange(newCoords);
      } catch (err) {
        console.warn("[AddressMapPicker] تعذر جلب الموقع الجغرافي:", err);
        setPermissionDenied(true);
      } finally {
        setLocating(false);
      }
    }

    if (!initialCoordinates || (initialCoordinates.latitude === JEDDAH_CENTER.latitude && initialCoordinates.longitude === JEDDAH_CENTER.longitude)) {
      requestUserLocation();
    }
  }, []);

  // تحديث الإحداثيات عند استقبال إحداثيات خارجية (مثل العنوان الوطني المختصر)
  useEffect(() => {
    if (initialCoordinates) {
      setCoords(initialCoordinates);
    }
  }, [initialCoordinates?.latitude, initialCoordinates?.longitude]);

  const handleManualMove = (deltaLat: number, deltaLng: number) => {
    const updated = {
      latitude: Number((coords.latitude + deltaLat).toFixed(6)),
      longitude: Number((coords.longitude + deltaLng).toFixed(6)),
    };
    setCoords(updated);
    onCoordinatesChange(updated);
  };

  // على منصة Native (iOS / Android): نستخدم react-native-maps
  // على منصة Web: نستخدم واجهة تحكم متجاوبة لحركة الخريطة لتفادي أعطال AirMapModule
  return (
    <View style={styles.container}>
      {Platform.OS !== "web" ? (
        <NativeMapView
          coords={coords}
          onRegionChange={(newCoords) => {
            setCoords(newCoords);
            onCoordinatesChange(newCoords);
          }}
        />
      ) : (
        <WebMapFallback
          coords={coords}
          onMove={handleManualMove}
          isRTL={isRTL}
        />
      )}

      {/* الدبوس الثابت في وسط الشاشة تماماً (Fixed Center Pin) */}
      <View pointerEvents="none" style={styles.centerPinContainer}>
        <View style={styles.pinWrapper}>
          <Ionicons
            name="location-sharp"
            size={44}
            color={isPinConfirmed ? "#16a34a" : "#dc2626"}
          />
          <View style={styles.pinDot} />
        </View>
      </View>

      {/* تنبيه رفض إذن الموقع */}
      {permissionDenied && (
        <View style={styles.permissionBanner}>
          <Ionicons name="information-circle" size={18} color="#92400e" />
          <Text style={styles.permissionText}>
            {t("customer.address.locationDenied")}
          </Text>
        </View>
      )}

      {/* مؤشر جلب الموقع */}
      {locating && (
        <View style={styles.locatingBadge}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.locatingText}>
            {t("customer.address.fetchingLocation")}
          </Text>
        </View>
      )}

      {/* شارة إحداثيات الموقع الحالية أسفل الخريطة */}
      <View style={styles.coordsOverlay}>
        <Text style={styles.coordsText}>
          📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
        </Text>
      </View>
    </View>
  );
}

// مكون الخريطة على الجوال (Expo Go)
function NativeMapView({
  coords,
  onRegionChange,
}: {
  coords: Coordinates;
  onRegionChange: (coords: Coordinates) => void;
}) {
  try {
    const MapView = require("react-native-maps").default;
    return (
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        onRegionChangeComplete={(region: { latitude: number; longitude: number }) => {
          onRegionChange({
            latitude: region.latitude,
            longitude: region.longitude,
          });
        }}
        showsUserLocation
        showsMyLocationButton
      />
    );
  } catch (err) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]}>
        <Text style={styles.fallbackText}>جاري تحميل الخريطة...</Text>
      </View>
    );
  }
}

// مكون الخريطة على المتصفح (Web Fallback لتجربة المطور)
function WebMapFallback({
  coords,
  onMove,
  isRTL,
}: {
  coords: Coordinates;
  onMove: (deltaLat: number, deltaLng: number) => void;
  isRTL: boolean;
}) {
  return (
    <View style={styles.webMapContainer}>
      <View style={styles.gridBackground} />
      <View style={styles.webControls}>
        <Text style={styles.webNotice}>
          حرّك الخريطة بواسطة الأسهم لتحديد موقع الدبوس بدقة:
        </Text>
        <View style={styles.dpad}>
          <TouchableOpacity
            style={styles.dpadBtn}
            onPress={() => onMove(0.002, 0)}
          >
            <Ionicons name="arrow-up" size={20} color="#1e293b" />
          </TouchableOpacity>
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPress={() => onMove(0, isRTL ? 0.002 : -0.002)}
            >
              <Ionicons name="arrow-back" size={20} color="#1e293b" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPress={() => onMove(0, isRTL ? -0.002 : 0.002)}
            >
              <Ionicons name="arrow-forward" size={20} color="#1e293b" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.dpadBtn}
            onPress={() => onMove(-0.002, 0)}
          >
            <Ionicons name="arrow-down" size={20} color="#1e293b" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: "#e2e8f0",
  },
  centerPinContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  pinWrapper: {
    alignItems: "center",
    marginBottom: 44, // ليكون رأس الدبوس في المركز بالضبط
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    marginTop: -2,
  },
  permissionBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  permissionText: {
    fontSize: 12,
    color: "#92400e",
    flex: 1,
  },
  locatingBadge: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locatingText: {
    fontSize: 12,
    color: "#1e293b",
  },
  coordsOverlay: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  coordsText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  webMapContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  gridBackground: {
    ...StyleSheet.absoluteFill,
    opacity: 0.06,
    backgroundColor: "#0284c7",
  },
  webControls: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  webNotice: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 8,
  },
  dpad: {
    alignItems: "center",
    gap: 4,
  },
  dpadRow: {
    flexDirection: "row",
    gap: 20,
  },
  dpadBtn: {
    backgroundColor: "#f1f5f9",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  fallbackContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackText: {
    color: "#64748b",
  },
});
