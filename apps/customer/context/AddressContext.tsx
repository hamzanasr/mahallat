import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useCustomerAuth } from "./CustomerAuthContext";
import type { Database } from "@mahallat/shared";
import { normalizeShortNationalAddress } from "@mahallat/shared";

export type CustomerAddress = Database["public"]["Tables"]["customer_addresses"]["Row"];

export interface GuestLocation {
  latitude: number;
  longitude: number;
  label: string;
  cityId?: string;
  cityName?: string;
  districtName?: string;
}

export interface AddressFormData {
  name: string;
  type: "house" | "apartment" | "office" | "other";
  latitude: number;
  longitude: number;
  pin_confirmed_at: string; // وقت التأكيد الصريح للدبوس (إلزامي CUS-002)
  district_name?: string;
  street_name?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  entry_instructions?: string;
  no_answer_instructions?: string;
  short_national_address?: string;
  is_default?: boolean;
}

interface AddressContextType {
  addresses: CustomerAddress[];
  currentAddress: CustomerAddress | null;
  guestLocation: GuestLocation | null;
  currentDisplayLabel: string;
  loading: boolean;
  loadAddresses: () => Promise<void>;
  checkLocationCoverage: (
    lat: number,
    lng: number
  ) => Promise<{ covered: boolean; city?: { id: string; name_ar: string; name_en: string } }>;
  saveAddress: (
    data: AddressFormData
  ) => Promise<{ success: boolean; address?: CustomerAddress; error?: string }>;
  updateAddress: (
    id: string,
    data: Partial<AddressFormData>
  ) => Promise<{ success: boolean; address?: CustomerAddress; error?: string }>;
  deleteAddress: (id: string) => Promise<{ success: boolean; error?: string }>;
  setDefaultAddress: (id: string) => Promise<{ success: boolean; error?: string }>;
  setCurrentAddress: (address: CustomerAddress) => Promise<void>;
  setGuestLocation: (location: GuestLocation) => Promise<void>;
  submitCoverageRequest: (
    lat: number,
    lng: number,
    district?: string,
    cityHint?: string,
    note?: string
  ) => Promise<{ success: boolean; error?: string }>;
  lookupNationalAddress: (
    shortCode: string
  ) => Promise<{
    success: boolean;
    data?: {
      latitude: number;
      longitude: number;
      district_name?: string;
      city_name?: string;
      street_name?: string;
      building_number?: string;
      short_code: string;
    };
    error?: string;
  }>;
}

const GUEST_LOCATION_KEY = "@mahallat_guest_location";
const SELECTED_ADDRESS_KEY = "@mahallat_selected_address_id";

const AddressContext = createContext<AddressContextType | undefined>(undefined);

export function AddressProvider({ children }: { children: React.ReactNode }) {
  const { user, deviceId } = useCustomerAuth();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [currentAddress, setCurrentAddressState] = useState<CustomerAddress | null>(null);
  const [guestLocation, setGuestLocationState] = useState<GuestLocation | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. تحميل العناوين المحفوظة للعميل
  const loadAddresses = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      setCurrentAddressState(null);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[AddressContext] خطأ في جلب العناوين:", error);
        return;
      }

      const list = (data || []) as CustomerAddress[];
      setAddresses(list);

      // تحديد العنوان الحالي المختار
      const savedSelectedId = await AsyncStorage.getItem(SELECTED_ADDRESS_KEY);
      const foundSelected = list.find((a) => a.id === savedSelectedId);
      const defaultAddr = list.find((a) => a.is_default) || list[0] || null;

      setCurrentAddressState(foundSelected || defaultAddr);
    } catch (err) {
      console.error("[AddressContext] خطأ أثناء تحميل العناوين:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 2. تحميل الموقع المؤقت للزائر
  useEffect(() => {
    async function loadGuestLoc() {
      try {
        const stored = await AsyncStorage.getItem(GUEST_LOCATION_KEY);
        if (stored) {
          setGuestLocationState(JSON.parse(stored));
        } else {
          // موقع افتراضي أولي في جدة لتسهيل التصفح كزائر
          const defaultGuest: GuestLocation = {
            latitude: 21.5433,
            longitude: 39.1728,
            label: "جدة - حي الروضة",
            districtName: "الروضة",
            cityName: "جدة",
          };
          setGuestLocationState(defaultGuest);
        }
      } catch (err) {
        console.error("[AddressContext] خطأ استرجاع موقع الزائر:", err);
      }
    }

    if (!user) {
      loadGuestLoc().then(() => setLoading(false));
    } else {
      loadAddresses();
    }
  }, [user, loadAddresses]);

  // 3. فحص التغطية الجغرافية عبر دالة PostGIS بالخادم (ADM-033, DSP-002)
  const checkLocationCoverage = useCallback(
    async (lat: number, lng: number) => {
      try {
        const { data, error } = await supabase.rpc("city_for_point", {
          lat,
          lng,
        });

        if (error) {
          console.error("[AddressContext] خطأ دالة فحص التغطية:", error);
          return { covered: false };
        }

        const city = Array.isArray(data) ? data[0] : data;
        if (city && city.id && city.is_active) {
          return {
            covered: true,
            city: {
              id: city.id,
              name_ar: city.name_ar,
              name_en: city.name_en,
            },
          };
        }
        return { covered: false };
      } catch (err) {
        console.error("[AddressContext] خطأ غير متوقع في فحص التغطية:", err);
        return { covered: false };
      }
    },
    []
  );

  // 4. حفظ عنوان جديد مع اشتراط تأكيد الدبوس CUS-002
  const saveAddress = useCallback(
    async (data: AddressFormData) => {
      if (!user) {
        return { success: false, error: "يجب تسجيل الدخول لحفظ العنوان" };
      }

      if (!data.pin_confirmed_at) {
        return { success: false, error: "وقت تأكيد الدبوس إلزامي لحفظ العنوان (CUS-002)" };
      }

      try {
        const insertPayload: Database["public"]["Tables"]["customer_addresses"]["Insert"] = {
          customer_id: user.id,
          name: data.name,
          type: data.type,
          latitude: data.latitude,
          longitude: data.longitude,
          location: `POINT(${data.longitude} ${data.latitude})` as unknown as Database["public"]["Tables"]["customer_addresses"]["Insert"]["location"],
          pin_confirmed_at: data.pin_confirmed_at,
          district_name: data.district_name || null,
          street_name: data.street_name || null,
          building: data.building || null,
          floor: data.floor || null,
          apartment: data.apartment || null,
          entry_instructions: data.entry_instructions || null,
          no_answer_instructions: data.no_answer_instructions || null,
          short_national_address: data.short_national_address
            ? normalizeShortNationalAddress(data.short_national_address)
            : null,
          is_default: data.is_default || false,
        };

        const { data: created, error } = await supabase
          .from("customer_addresses")
          .insert(insertPayload)
          .select("*")
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        const newAddr = created as CustomerAddress;
        await loadAddresses();
        await setCurrentAddress(newAddr);

        return { success: true, address: newAddr };
      } catch (err: unknown) {
        const error = err as Error;
        return { success: false, error: error?.message || "فشل حفظ العنوان" };
      }
    },
    [user, loadAddresses]
  );

  // 5. تعديل عنوان
  const updateAddress = useCallback(
    async (id: string, data: Partial<AddressFormData>) => {
      if (!user) return { success: false, error: "غير مصرح" };

      try {
        const updatePayload: Database["public"]["Tables"]["customer_addresses"]["Update"] = {};
        if (data.name) updatePayload.name = data.name;
        if (data.type) updatePayload.type = data.type;
        if (data.latitude && data.longitude) {
          updatePayload.latitude = data.latitude;
          updatePayload.longitude = data.longitude;
          updatePayload.location = `POINT(${data.longitude} ${data.latitude})` as unknown as Database["public"]["Tables"]["customer_addresses"]["Update"]["location"];
          if (!data.pin_confirmed_at) {
            return { success: false, error: "عند تغيير الموقع يلزم إعادة تأكيد الدبوس" };
          }
          updatePayload.pin_confirmed_at = data.pin_confirmed_at;
        }
        if (data.district_name !== undefined) updatePayload.district_name = data.district_name;
        if (data.street_name !== undefined) updatePayload.street_name = data.street_name;
        if (data.building !== undefined) updatePayload.building = data.building;
        if (data.floor !== undefined) updatePayload.floor = data.floor;
        if (data.apartment !== undefined) updatePayload.apartment = data.apartment;
        if (data.entry_instructions !== undefined) updatePayload.entry_instructions = data.entry_instructions;
        if (data.no_answer_instructions !== undefined) updatePayload.no_answer_instructions = data.no_answer_instructions;
        if (data.short_national_address !== undefined) {
          updatePayload.short_national_address = data.short_national_address
            ? normalizeShortNationalAddress(data.short_national_address)
            : null;
        }
        if (data.is_default !== undefined) updatePayload.is_default = data.is_default;

        const { data: updated, error } = await supabase
          .from("customer_addresses")
          .update(updatePayload)
          .eq("id", id)
          .select("*")
          .single();

        if (error) return { success: false, error: error.message };

        await loadAddresses();
        return { success: true, address: updated as CustomerAddress };
      } catch (err: unknown) {
        const error = err as Error;
        return { success: false, error: error?.message || "فشل تعديل العنوان" };
      }
    },
    [user, loadAddresses]
  );

  // 6. حذف عنوان
  const deleteAddress = useCallback(
    async (id: string) => {
      if (!user) return { success: false, error: "غير مصرح" };

      try {
        const { error } = await supabase
          .from("customer_addresses")
          .delete()
          .eq("id", id);

        if (error) return { success: false, error: error.message };

        if (currentAddress?.id === id) {
          await AsyncStorage.removeItem(SELECTED_ADDRESS_KEY);
        }
        await loadAddresses();
        return { success: true };
      } catch (err: unknown) {
        const error = err as Error;
        return { success: false, error: error?.message || "فشل حذف العنوان" };
      }
    },
    [user, currentAddress, loadAddresses]
  );

  // 7. تعيين كافتراضي
  const setDefaultAddress = useCallback(
    async (id: string) => {
      if (!user) return { success: false, error: "غير مصرح" };

      try {
        const { error } = await supabase
          .from("customer_addresses")
          .update({ is_default: true })
          .eq("id", id);

        if (error) return { success: false, error: error.message };

        await loadAddresses();
        return { success: true };
      } catch (err: unknown) {
        const error = err as Error;
        return { success: false, error: error?.message || "فشل تعيين العنوان كافتراضي" };
      }
    },
    [user, loadAddresses]
  );

  // 8. اختيار العنوان الحالي
  const setCurrentAddress = useCallback(async (address: CustomerAddress) => {
    setCurrentAddressState(address);
    try {
      await AsyncStorage.setItem(SELECTED_ADDRESS_KEY, address.id);
    } catch (err) {
      console.error("[AddressContext] خطأ تخزين العنوان الحالي:", err);
    }
  }, []);

  // 9. تعيين موقع الزائر
  const setGuestLocation = useCallback(async (loc: GuestLocation) => {
    setGuestLocationState(loc);
    try {
      await AsyncStorage.setItem(GUEST_LOCATION_KEY, JSON.stringify(loc));
    } catch (err) {
      console.error("[AddressContext] خطأ تخزين موقع الزائر:", err);
    }
  }, []);

  // 10. إرسال طلب تغطية (ADM-033)
  const submitCoverageRequest = useCallback(
    async (
      lat: number,
      lng: number,
      district?: string,
      cityHint?: string,
      note?: string
    ) => {
      try {
        const { error } = await supabase.rpc("submit_coverage_request", {
          p_lat: lat,
          p_lng: lng,
          p_device_id: deviceId || undefined,
          p_district_name: district || undefined,
          p_city_hint: cityHint || undefined,
          p_note: note || undefined,
        });

        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      } catch (err: unknown) {
        const error = err as Error;
        return { success: false, error: error?.message || "فشل إرسال طلب التغطية" };
      }
    },
    [deviceId]
  );

  // 11. استعلام العنوان الوطني المختصر عبر دالة الخادم (CUS-002)
  const lookupNationalAddress = useCallback(async (shortCode: string) => {
    try {
      const code = normalizeShortNationalAddress(shortCode);
      const { data, error } = await supabase.functions.invoke("national-address", {
        body: { short_code: code },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && data.success) {
        return { success: true, data };
      } else {
        return {
          success: false,
          error: data?.error?.message || "لم يتم العثور على العنوان",
        };
      }
    } catch (err: unknown) {
      const error = err as Error;
      return { success: false, error: error?.message || "خطأ أثناء جلب العنوان الوطني" };
    }
  }, []);

  // نص العرض للعنوان في رأس التطبيق
  const currentDisplayLabel = user && currentAddress
    ? currentAddress.name || currentAddress.district_name || "عنواني"
    : guestLocation?.label || guestLocation?.districtName || "تحديد موقع التوصيل";

  return (
    <AddressContext.Provider
      value={{
        addresses,
        currentAddress,
        guestLocation,
        currentDisplayLabel,
        loading,
        loadAddresses,
        checkLocationCoverage,
        saveAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        setCurrentAddress,
        setGuestLocation,
        submitCoverageRequest,
        lookupNationalAddress,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
}

export function useAddress() {
  const context = useContext(AddressContext);
  if (!context) {
    throw new Error("useAddress must be used within an AddressProvider");
  }
  return context;
}
