import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { normalizeSaudiPhone } from "@mahallat/shared";
import type { Database } from "@mahallat/shared";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface CustomerAuthContextType {
  user: User | null;
  profile: Profile | null;
  isGuest: boolean;
  loading: boolean;
  deviceId: string;
  marketingConsent: boolean;
  termsAccepted: boolean;
  sendOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (
    phone: string,
    token: string
  ) => Promise<{ success: boolean; needsProfile: boolean; error?: string }>;
  completeProfile: (
    fullName: string,
    marketingOptIn: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  updateName: (fullName: string) => Promise<{ success: boolean; error?: string }>;
  setMarketingConsent: (granted: boolean) => Promise<{ success: boolean; error?: string }>;
  requestAccountDeletion: (
    reason: string,
    acknowledged: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DEVICE_ID_KEY = "@mahallat_device_id";

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string>("");
  const [marketingConsent, setMarketingConsentState] = useState(false);
  const [termsAccepted, setTermsAcceptedState] = useState(false);

  // 1. استرجاع أو إنشاء معرّف الجهاز (Installation ID)
  useEffect(() => {
    async function initDevice() {
      try {
        let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!storedId) {
          storedId = generateUUID();
          await AsyncStorage.setItem(DEVICE_ID_KEY, storedId);
        }
        setDeviceId(storedId);
      } catch {
        setDeviceId(generateUUID());
      }
    }
    initDevice();
  }, []);

  // 2. فحص جلسة المستخدم عند بدء التشغيل
  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await loadUserProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.warn("[CustomerAuth] Error restoring session:", err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    // الاستماع لتغيرات الجلسة
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await loadUserProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setMarketingConsentState(false);
          setTermsAcceptedState(false);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 3. جلب الملف الشخصي وسجل الموافقات
  const loadUserProfile = async (userId: string) => {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (prof) {
        setProfile(prof);
      }

      // جلب آخر حالة للموافقات (REG-004)
      const { data: consents } = await supabase
        .from("user_consents")
        .select("consent_type, status, version")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (consents) {
        const termsConsent = consents.find(
          (c) => c.consent_type === "terms_and_privacy" && c.status === "granted"
        );
        const ageConsent = consents.find(
          (c) => c.consent_type === "age_18" && c.status === "granted"
        );
        setTermsAcceptedState(Boolean(termsConsent && ageConsent));

        // آخر حالة للتسويق
        const latestMarketing = consents.find((c) => c.consent_type === "marketing");
        setMarketingConsentState(latestMarketing?.status === "granted");
      }
    } catch (err) {
      console.warn("[CustomerAuth] Error loading profile:", err);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await loadUserProfile(user.id);
    }
  };

  // 4. إرسال رمز التحقق برقم الجوال
  const sendOtp = async (rawPhone: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const phone = normalizeSaudiPhone(rawPhone);
      if (!phone) {
        return { success: false, error: "رقم الجوال غير صالح" };
      }

      // فحص حد الرسائل برمجياً مسبقاً (ADM-001)
      const { data: limitCheck, error: limitErr } = await supabase.rpc(
        "check_and_record_otp_request",
        {
          p_phone: phone,
          p_device_id: deviceId || undefined,
        }
      );

      const checkObj = limitCheck as Record<string, any> | null;
      if (!limitErr && checkObj && checkObj.allowed === false) {
        return {
          success: false,
          error: checkObj.message || "تم تجاوز الحد الأقصى لرسائل التحقق لهذا الرقم",
        };
      }

      // إرسال الرمز عبر Supabase Auth (Send SMS Hook)
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "حدث خطأ غير متوقع" };
    }
  };

  // 5. التحقق من الرمز المدخل
  const verifyOtp = async (
    rawPhone: string,
    token: string
  ): Promise<{ success: boolean; needsProfile: boolean; error?: string }> => {
    try {
      const phone = normalizeSaudiPhone(rawPhone);
      if (!phone) {
        return { success: false, needsProfile: false, error: "رقم الجوال غير صالح" };
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: token.trim(),
        type: "sms",
      });

      if (error || !data.user) {
        return {
          success: false,
          needsProfile: false,
          error: error?.message || "رمز التحقق غير صحيح أو منتهي الصلاحية",
        };
      }

      setUser(data.user);

      // فحص هل العميل أكمل بياناته مسبقاً (الاسم وإقرار السن 18+)
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user.id)
        .single();

      const { data: ageConsent } = await supabase
        .from("user_consents")
        .select("id")
        .eq("user_id", data.user.id)
        .eq("consent_type", "age_18")
        .eq("status", "granted")
        .limit(1);

      const hasName = Boolean(prof?.full_name && prof.full_name.trim().length > 0);
      const hasAgeConsent = Boolean(ageConsent && ageConsent.length > 0);
      const needsProfile = !hasName || !hasAgeConsent;

      await loadUserProfile(data.user.id);

      return { success: true, needsProfile };
    } catch (err: any) {
      return { success: false, needsProfile: false, error: err?.message || "حدث خطأ أثناء التحقق" };
    }
  };

  // 6. إكمال البيانات لأول مرة (CUS-012, REG-004)
  const completeProfile = async (
    fullName: string,
    marketingOptIn: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: "المستخدم غير مسجل" };
    }

    if (!fullName || fullName.trim().length < 2) {
      return { success: false, error: "يرجى كتابة الاسم الكامل" };
    }

    try {
      // 1. تحديث الاسم في profiles
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profErr) {
        return { success: false, error: profErr.message };
      }

      // 2. تسجيل الموافقة على الشروط والخصوصية والإقرار بالسن (CUS-012, REG-004)
      const deviceInfo = { device_id: deviceId, app: "customer" };

      const { error: consentErr } = await supabase.from("user_consents").insert([
        {
          user_id: user.id,
          consent_type: "terms_and_privacy",
          status: "granted",
          version: "1.0",
          device_info: deviceInfo,
        },
        {
          user_id: user.id,
          consent_type: "age_18",
          status: "granted",
          version: "1.0",
          device_info: deviceInfo,
        },
      ]);

      if (consentErr) {
        return { success: false, error: consentErr.message };
      }

      // 3. تسجيل الموافقة على التسويق إذا وافق عليها (CUS-001)
      if (marketingOptIn) {
        await supabase.from("user_consents").insert([
          {
            user_id: user.id,
            consent_type: "marketing",
            status: "granted",
            version: "1.0",
            device_info: deviceInfo,
          },
        ]);
        setMarketingConsentState(true);
      }

      setTermsAcceptedState(true);
      await loadUserProfile(user.id);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل إكمال البيانات" };
    }
  };

  // 7. تعديل الاسم
  const updateName = async (fullName: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "غير مسجل" };

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) return { success: false, error: error.message };

      await loadUserProfile(user.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  };

  // 8. تغيير وتوثيق موافقة التسويق (سحب أو منح - CUS-001, REG-004)
  const setMarketingConsent = async (
    granted: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "غير مسجل" };

    try {
      const { error } = await supabase.from("user_consents").insert([
        {
          user_id: user.id,
          consent_type: "marketing",
          status: granted ? "granted" : "revoked",
          version: "1.0",
          device_info: { device_id: deviceId },
        },
      ]);

      if (error) return { success: false, error: error.message };

      setMarketingConsentState(granted);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  };

  // 9. طلب حذف الحساب (CUS-001)
  const requestAccountDeletion = async (
    reason: string,
    acknowledged: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user || !profile) return { success: false, error: "غير مسجل" };
    if (!acknowledged) {
      return { success: false, error: "يجب الموافقة والإقرار بسقوط الرصيد الترويجي والتعويض" };
    }

    try {
      const { error } = await supabase.from("account_deletion_requests").insert([
        {
          user_id: user.id,
          phone: profile.phone || user.phone || "",
          reason: reason.trim() || null,
          acknowledged_forfeiture: true,
          status: "pending",
        },
      ]);

      if (error) return { success: false, error: error.message };

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  };

  // 10. تسجيل الخروج
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[CustomerAuth] Error signing out:", err);
    } finally {
      setUser(null);
      setProfile(null);
      setMarketingConsentState(false);
      setTermsAcceptedState(false);
    }
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        user,
        profile,
        isGuest: !user,
        loading,
        deviceId,
        marketingConsent,
        termsAccepted,
        sendOtp,
        verifyOtp,
        completeProfile,
        updateName,
        setMarketingConsent,
        requestAccountDeletion,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  }
  return context;
}
