import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useAddress } from "./AddressContext";

export interface CartItem {
  lineId: string;
  itemId: string;
  nameAr: string;
  nameEn: string;
  imageUrl?: string | null;
  sizeId: string | null;
  sizeNameAr?: string | null;
  sizeNameEn?: string | null;
  optionIds: string[];
  optionsSummaryAr?: string | null;
  quantity: number;
  unitPriceHalalas: number;
  note?: string;
}

export interface QuoteLine {
  item_id: string;
  name_ar: string;
  name_en: string;
  size_id: string | null;
  size_name_ar: string | null;
  quantity: number;
  unit_price_halalas: number;
  line_total_halalas: number;
}

export interface QuoteError {
  code: string;
  item_id?: string;
  item_name_ar?: string;
  message: string;
}

export interface SuggestedItem {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar?: string | null;
  description_en?: string | null;
  image_url?: string | null;
  customer_price_halalas: number;
  calories_value?: number | null;
  is_sfda_exempt?: boolean;
  allergens?: string[] | null;
  is_high_salt?: boolean;
  caffeine_mg?: number | null;
  has_sizes: boolean;
  sizes?: any[];
  option_groups?: any[];
}

export interface CartQuote {
  success: boolean;
  errors: QuoteError[];
  store_id: string;
  branch_id: string;
  branch_name_ar: string;
  is_open: boolean;
  next_open_at: string | null;
  closes_at: string | null;
  lines: QuoteLine[];
  products_total_halalas: number;
  delivery_fee_halalas: number;
  service_fee_halalas: number;
  discount_halalas: number;
  tip_halalas: number;
  wallet_halalas: number;
  total_halalas: number;
  min_order_halalas: number;
  min_order_reached: boolean;
  min_order_shortfall_halalas: number;
  distance_km: number;
  time_estimate?: {
    display_range: string;
    customer_total_min: number;
    customer_total_max: number;
  } | null;
  is_device_location_divergent: boolean;
  suggested_items: SuggestedItem[];
  pricing_snapshot?: any;
}

export type OutOfStockAction = "remove" | "call" | "cancel";

interface CartContextType {
  storeId: string | null;
  storeName: string | null;
  items: CartItem[];
  itemCount: number;
  quote: CartQuote | null;
  loadingQuote: boolean;
  storeNote: string;
  setStoreNote: (note: string) => void;
  outOfStockAction: OutOfStockAction;
  setOutOfStockAction: (action: OutOfStockAction) => void;
  expiredAlert: string | null;
  clearExpiredAlert: () => void;
  addItem: (params: {
    storeId: string;
    storeName: string;
    item: {
      id: string;
      name_ar: string;
      name_en: string;
      image_url?: string | null;
      customer_price_halalas: number;
    };
    size?: { id: string; name_ar: string; name_en: string; customer_price_halalas: number } | null;
    options?: Array<{ id: string; name_ar: string; price_delta_halalas: number }>;
    quantity?: number;
    note?: string;
  }) => { requiresSwitchConfirmation?: boolean; currentStoreName?: string };
  confirmSwitchAndAdd: (params: {
    storeId: string;
    storeName: string;
    item: {
      id: string;
      name_ar: string;
      name_en: string;
      image_url?: string | null;
      customer_price_halalas: number;
    };
    size?: { id: string; name_ar: string; name_en: string; customer_price_halalas: number } | null;
    options?: Array<{ id: string; name_ar: string; price_delta_halalas: number }>;
    quantity?: number;
    note?: string;
  }) => void;
  updateQuantity: (lineId: string, newQty: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  refreshQuote: () => Promise<void>;
}

const STORAGE_KEY = "@mahallat_customer_cart_v1";

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { currentAddress, guestLocation } = useAddress();

  const activeLat = currentAddress?.latitude ?? guestLocation?.latitude ?? null;
  const activeLng = currentAddress?.longitude ?? guestLocation?.longitude ?? null;

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState<boolean>(false);
  const [storeNote, setStoreNote] = useState<string>("");
  const [outOfStockAction, setOutOfStockAction] = useState<OutOfStockAction>("remove");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [expiredAlert, setExpiredAlert] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // 1. تحميل السلة من التخزين المحلي والتحقق من انتهاء الصلاحية (CRT-004)
  useEffect(() => {
    async function loadCart() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          const exp = data.expiresAt ? new Date(data.expiresAt) : null;
          const now = new Date();

          if (exp && exp <= now) {
            // انتهت صلاحية السلة
            await AsyncStorage.removeItem(STORAGE_KEY);
            setExpiredAlert("انتهت صلاحية السلة السابقة وبدأنا لك سلة جديدة");
          } else {
            setStoreId(data.storeId || null);
            setStoreName(data.storeName || null);
            setItems(data.items || []);
            setStoreNote(data.storeNote || "");
            setOutOfStockAction(data.outOfStockAction || "remove");
            setExpiresAt(data.expiresAt || null);
          }
        }
      } catch (err) {
        console.error("Failed to load cart from AsyncStorage:", err);
      } finally {
        setIsLoaded(true);
      }
    }
    loadCart();
  }, []);

  // 2. حفظ السلة في التخزين المحلي عند أي تعديل
  useEffect(() => {
    if (!isLoaded) return;
    async function saveCart() {
      try {
        if (items.length === 0) {
          await AsyncStorage.removeItem(STORAGE_KEY);
        } else {
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              storeId,
              storeName,
              items,
              storeNote,
              outOfStockAction,
              expiresAt,
            })
          );
        }
      } catch (err) {
        console.error("Failed to save cart to AsyncStorage:", err);
      }
    }
    saveCart();
  }, [storeId, storeName, items, storeNote, outOfStockAction, expiresAt, isLoaded]);

  // 3. إعادة تسعير السلة عبر الخادم بواسطة quote_cart (CRT-001, CRT-005)
  const refreshQuote = useCallback(async () => {
    if (!storeId || items.length === 0 || activeLat === null || activeLng === null) {
      setQuote(null);
      return;
    }

    setLoadingQuote(true);
    try {
      const payloadItems = items.map((i) => ({
        item_id: i.itemId,
        size_id: i.sizeId || undefined,
        option_ids: i.optionIds,
        quantity: i.quantity,
      }));

      // نمرر إحداثيات الجهاز الحالية وإحداثيات العنوان لفحص تنبيه التباعد (CUS-002)
      const deviceLat = guestLocation?.latitude || activeLat;
      const deviceLng = guestLocation?.longitude || activeLng;

      const { data, error } = await supabase.rpc("quote_cart", {
        p_store_id: storeId,
        p_lat: activeLat,
        p_lng: activeLng,
        p_items: payloadItems as any,
        p_device_lat: deviceLat,
        p_device_lng: deviceLng,
      });

      if (!error && data) {
        const q = data as unknown as CartQuote;
        setQuote(q);

        // ضبط انتهاء الصلاحية وفق نهاية دوام الفرع أو 24 ساعة (CRT-004)
        if (q.closes_at) {
          setExpiresAt(q.closes_at);
        } else if (!expiresAt) {
          const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          setExpiresAt(defaultExpiry);
        }
      }
    } catch (err) {
      console.error("Failed to quote cart:", err);
    } finally {
      setLoadingQuote(false);
    }
  }, [storeId, items, activeLat, activeLng, guestLocation, expiresAt]);

  useEffect(() => {
    if (isLoaded) {
      refreshQuote();
    }
  }, [refreshQuote, isLoaded]);

  // إضافة صنف مع فحص متجر واحد فقط (CRT-001)
  const addItemInternal = (
    sId: string,
    sName: string,
    item: { id: string; name_ar: string; name_en: string; image_url?: string | null; customer_price_halalas: number },
    size?: { id: string; name_ar: string; name_en: string; customer_price_halalas: number } | null,
    options?: Array<{ id: string; name_ar: string; price_delta_halalas: number }>,
    quantity: number = 1,
    note: string = ""
  ) => {
    const sizeId = size ? size.id : null;
    const sortedOptionIds = (options || []).map((o) => o.id).sort();
    const lineId = `${item.id}_${sizeId || "nosize"}_${sortedOptionIds.join("-")}_${note.trim()}`;

    // حساب السعر التقديري المبدئي للعرض
    let unitPrice = size ? size.customer_price_halalas : item.customer_price_halalas;
    if (options) {
      unitPrice += options.reduce((sum, opt) => sum + opt.price_delta_halalas, 0);
    }

    const optionsSummary = (options || []).map((o) => o.name_ar).join("، ");

    setStoreId(sId);
    setStoreName(sName);

    setItems((prev) => {
      const existingIdx = prev.findIndex((p) => p.lineId === lineId);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + quantity,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            lineId,
            itemId: item.id,
            nameAr: item.name_ar,
            nameEn: item.name_en,
            imageUrl: item.image_url,
            sizeId,
            sizeNameAr: size?.name_ar,
            sizeNameEn: size?.name_en,
            optionIds: sortedOptionIds,
            optionsSummaryAr: optionsSummary || undefined,
            quantity,
            unitPriceHalalas: unitPrice,
            note: note.trim() || undefined,
          },
        ];
      }
    });
  };

  const addItem: CartContextType["addItem"] = (params) => {
    if (storeId && storeId !== params.storeId && items.length > 0) {
      return {
        requiresSwitchConfirmation: true,
        currentStoreName: storeName || "",
      };
    }

    addItemInternal(
      params.storeId,
      params.storeName,
      params.item,
      params.size,
      params.options,
      params.quantity || 1,
      params.note || ""
    );

    return {};
  };

  const confirmSwitchAndAdd: CartContextType["confirmSwitchAndAdd"] = (params) => {
    // تفريغ السلة والبدء بالمتجر الجديد (CRT-001)
    setItems([]);
    addItemInternal(
      params.storeId,
      params.storeName,
      params.item,
      params.size,
      params.options,
      params.quantity || 1,
      params.note || ""
    );
  };

  const updateQuantity = (lineId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(lineId);
      return;
    }

    setItems((prev) =>
      prev.map((item) => (item.lineId === lineId ? { ...item, quantity: newQty } : item))
    );
  };

  const removeItem = (lineId: string) => {
    setItems((prev) => {
      const remaining = prev.filter((item) => item.lineId !== lineId);
      if (remaining.length === 0) {
        setStoreId(null);
        setStoreName(null);
        setQuote(null);
        setExpiresAt(null);
      }
      return remaining;
    });
  };

  const clearCart = () => {
    setItems([]);
    setStoreId(null);
    setStoreName(null);
    setQuote(null);
    setExpiresAt(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  };

  const clearExpiredAlert = () => setExpiredAlert(null);

  const itemCount = useMemo(() => items.reduce((acc, i) => acc + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        storeId,
        storeName,
        items,
        itemCount,
        quote,
        loadingQuote,
        storeNote,
        setStoreNote,
        outOfStockAction,
        setOutOfStockAction,
        expiredAlert,
        clearExpiredAlert,
        addItem,
        confirmSwitchAndAdd,
        updateQuantity,
        removeItem,
        clearCart,
        refreshQuote,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
