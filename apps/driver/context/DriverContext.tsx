import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Alert, Platform } from "react-native";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { useDriverAuth } from "./DriverAuthContext";
import type { Database } from "@mahallat/shared";

type OrderOffer = Database["public"]["Tables"]["driver_order_offers"]["Row"] & {
  order?: Database["public"]["Tables"]["orders"]["Row"];
};
type Order = Database["public"]["Tables"]["orders"]["Row"];

interface DriverContextType {
  isOnline: boolean;
  incomingOffer: OrderOffer | null;
  activeTasks: Order[];
  currentLocation: { latitude: number; longitude: number } | null;
  toggleOnline: (active: boolean) => Promise<{ success: boolean; error?: string }>;
  acknowledgeUniform: () => Promise<{ success: boolean; error?: string }>;
  acceptOffer: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  rejectOffer: (orderId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  arriveAtStore: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  pickupOrder: (orderId: string, pickupCode: string, photoUrl: string) => Promise<{ success: boolean; error?: string }>;
  arriveAtCustomer: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  deliverOrder: (
    orderId: string,
    deliveryCode: string,
    photoUrl: string,
    isLeaveAtDoor?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  refreshTasks: () => Promise<void>;
}

const DriverContext = createContext<DriverContextType | undefined>(undefined);

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const { user, driver, refreshDriver } = useDriverAuth();
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [incomingOffer, setIncomingOffer] = useState<OrderOffer | null>(null);
  const [activeTasks, setActiveTasks] = useState<Order[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (driver) {
      setIsOnline(driver.is_active);
    }
  }, [driver]);

  // تحميل المهام النشطة الحالية
  const refreshTasks = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", user.id)
        .in("status", ["preparing", "ready_for_pickup", "picked_up", "in_transit", "arrived"])
        .order("created_at", { ascending: false });

      if (!error && data) {
        setActiveTasks(data as Order[]);
      }
    } catch (err) {
      console.error("[refreshTasks error]", err);
    }
  }, [user]);

  // متابعة الموقع الجغرافي وبثه للخادم
  useEffect(() => {
    let watcher: Location.LocationSubscription | null = null;
    let cancelled = false;

    async function startLocationTracking() {
      if (!user || !isOnline) return;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("[Driver Location Permission Denied]");
          return;
        }

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!cancelled) {
          setCurrentLocation({
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
          });

          // إرسال للخادم
          await (supabase.rpc as any)("driver_update_location", {
            p_driver_id: user.id,
            p_lat: initial.coords.latitude,
            p_lng: initial.coords.longitude,
            p_speed_kmh: initial.coords.speed ? initial.coords.speed * 3.6 : null,
            p_heading: initial.coords.heading || null,
            p_accuracy_meters: initial.coords.accuracy || null,
            p_is_mock: initial.mocked || false,
          });
        }

        watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 15,
          },
          async (pos) => {
            if (cancelled) return;
            setCurrentLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });

            await (supabase.rpc as any)("driver_update_location", {
              p_driver_id: user.id,
              p_lat: pos.coords.latitude,
              p_lng: pos.coords.longitude,
              p_speed_kmh: pos.coords.speed ? pos.coords.speed * 3.6 : null,
              p_heading: pos.coords.heading || null,
              p_accuracy_meters: pos.coords.accuracy || null,
              p_is_mock: pos.mocked || false,
            });
          }
        );
      } catch (err) {
        console.error("[startLocationTracking error]", err);
      }
    }

    if (isOnline) {
      startLocationTracking();
    }

    return () => {
      cancelled = true;
      if (watcher) {
        watcher.remove();
      }
    };
  }, [user, isOnline]);

  // الاستماع لعروض الطلبات اللحظية (Realtime Offers)
  useEffect(() => {
    if (!user || !isOnline) {
      setIncomingOffer(null);
      return;
    }
    const currentUserId = user.id;

    // فحص أي عرض حالي غير منتهي
    async function checkExistingOffers() {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("driver_order_offers")
        .select("*, order:orders(*)")
        .eq("driver_id", currentUserId)
        .eq("status", "offered")
        .gt("expires_at", now)
        .order("offered_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setIncomingOffer(data as OrderOffer);
      } else {
        setIncomingOffer(null);
      }
    }
    checkExistingOffers();
    refreshTasks();

    // الاشتراك في Realtime
    const channel = supabase
      .channel(`driver_offers:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_order_offers",
          filter: `driver_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const offer = payload.new as any;
            if (offer.status === "offered" && new Date(offer.expires_at) > new Date()) {
              const { data: orderData } = await supabase
                .from("orders")
                .select("*")
                .eq("id", offer.order_id)
                .single();
              setIncomingOffer({ ...offer, order: orderData } as OrderOffer);
            } else if (offer.status !== "offered") {
              setIncomingOffer((prev) => (prev?.id === offer.id ? null : prev));
              refreshTasks();
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `driver_id=eq.${user.id}`,
        },
        () => {
          refreshTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isOnline, refreshTasks]);

  // إقرار الزي الموحد (DRV-010)
  const acknowledgeUniform = async () => {
    if (!user) return { success: false, error: "يجب تسجيل الدخول أولاً" };
    try {
      const { data, error } = await (supabase.rpc as any)("driver_acknowledge_uniform", {
        p_driver_id: user.id,
      });
      if (error) return { success: false, error: error.message };
      await refreshDriver();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // تبديل حالة الاتصال (DRV-001, DRV-010)
  const toggleOnline = async (active: boolean) => {
    if (!user) return { success: false, error: "يجب تسجيل الدخول أولاً" };
    try {
      const { data, error } = await (supabase.rpc as any)("driver_toggle_active", {
        p_driver_id: user.id,
        p_active: active,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setIsOnline(active);
      await refreshDriver();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "حدث خطأ أثناء تغيير الحالة" };
    }
  };

  // قبول العرض (DSP-001, ORD-006)
  const acceptOffer = async (orderId: string) => {
    if (!user) return { success: false, error: "يجب تسجيل الدخول أولاً" };
    try {
      const { data, error } = await (supabase.rpc as any)("driver_accept_order", {
        p_driver_id: user.id,
        p_order_id: orderId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setIncomingOffer(null);
      await refreshTasks();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "فشل قبول الطلب" };
    }
  };

  // رفض العرض (DSP-001)
  const rejectOffer = async (orderId: string, reason?: string) => {
    if (!user) return { success: false, error: "يجب تسجيل الدخول أولاً" };
    try {
      const { data, error } = await (supabase.rpc as any)("driver_reject_order", {
        p_driver_id: user.id,
        p_order_id: orderId,
        p_reason: reason || "refused_by_driver",
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setIncomingOffer(null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "فشل رفض الطلب" };
    }
  };

  // 1. وصول المتجر داخل 100 متر (ORD-005)
  const arriveAtStore = async (orderId: string) => {
    if (!user) return { success: false, error: "يجب تسجيل الدخول" };
    const loc = currentLocation || { latitude: 21.578, longitude: 39.141 }; // جدة افتراضي
    try {
      const { data, error } = await (supabase.rpc as any)("driver_arrive_at_store", {
        p_driver_id: user.id,
        p_order_id: orderId,
        p_driver_lat: loc.latitude,
        p_driver_lng: loc.longitude,
      });
      if (error) return { success: false, error: error.message };
      await refreshTasks();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // 2. استلام الطلب من المتجر (ORD-005)
  const pickupOrder = async (orderId: string, pickupCode: string, photoUrl: string) => {
    if (!user) return { success: false, error: "يجب تسجيل الدخول" };
    const loc = currentLocation || { latitude: 21.578, longitude: 39.141 };
    try {
      const { data, error } = await (supabase.rpc as any)("driver_pickup_order", {
        p_driver_id: user.id,
        p_order_id: orderId,
        p_pickup_code: pickupCode,
        p_photo_url: photoUrl,
        p_driver_lat: loc.latitude,
        p_driver_lng: loc.longitude,
      });
      if (error) return { success: false, error: error.message };
      await refreshTasks();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // 3. وصول المندوب للعميل (ORD-005, ORD-008)
  const arriveAtCustomer = async (orderId: string) => {
    if (!user) return { success: false, error: "يجب تسجيل الدخول" };
    const loc = currentLocation || { latitude: 21.578, longitude: 39.141 };
    try {
      const { data, error } = await (supabase.rpc as any)("driver_arrive_at_customer", {
        p_driver_id: user.id,
        p_order_id: orderId,
        p_driver_lat: loc.latitude,
        p_driver_lng: loc.longitude,
      });
      if (error) return { success: false, error: error.message };
      await refreshTasks();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // 4. تسليم الطلب للعميل (ORD-005, ORD-010)
  const deliverOrder = async (
    orderId: string,
    deliveryCode: string,
    photoUrl: string,
    isLeaveAtDoor = false
  ) => {
    if (!user) return { success: false, error: "يجب تسجيل الدخول" };
    const loc = currentLocation || { latitude: 21.578, longitude: 39.141 };
    try {
      const { data, error } = await (supabase.rpc as any)("driver_deliver_order", {
        p_driver_id: user.id,
        p_order_id: orderId,
        p_delivery_code: deliveryCode,
        p_photo_url: photoUrl,
        p_is_leave_at_door: isLeaveAtDoor,
        p_driver_lat: loc.latitude,
        p_driver_lng: loc.longitude,
      });
      if (error) return { success: false, error: error.message };
      await refreshTasks();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return (
    <DriverContext.Provider
      value={{
        isOnline,
        incomingOffer,
        activeTasks,
        currentLocation,
        toggleOnline,
        acknowledgeUniform,
        acceptOffer,
        rejectOffer,
        arriveAtStore,
        pickupOrder,
        arriveAtCustomer,
        deliverOrder,
        refreshTasks,
      }}
    >
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  const context = useContext(DriverContext);
  if (!context) {
    throw new Error("useDriver must be used within a DriverProvider");
  }
  return context;
}
