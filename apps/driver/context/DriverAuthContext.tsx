import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { normalizeSaudiPhone } from "@mahallat/shared";
import type { Database } from "@mahallat/shared";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Driver = Database["public"]["Tables"]["drivers"]["Row"];

interface DriverAuthContextType {
  user: User | null;
  profile: Profile | null;
  driver: Driver | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (
    phone: string,
    token: string
  ) => Promise<{ success: boolean; error?: string }>;
  refreshDriver: () => Promise<void>;
  signOut: () => Promise<void>;
}

const DriverAuthContext = createContext<DriverAuthContextType | undefined>(undefined);

export function DriverAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfileAndDriver(userId: string) {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (prof) setProfile(prof);

      const { data: drv } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", userId)
        .single();
      if (drv) setDriver(drv);
    } catch (err) {
      console.error("[loadProfileAndDriver error]", err);
    }
  }

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await loadProfileAndDriver(session.user.id);
        }
      } catch (err) {
        console.error("[initAuth error]", err);
      } finally {
        setLoading(false);
      }
    }
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          await loadProfileAndDriver(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setDriver(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const sendOtp = async (rawPhone: string) => {
    try {
      const normalized = normalizeSaudiPhone(rawPhone);
      if (!normalized) {
        return { success: false, error: "رقم الجوال غير صالح" };
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone: normalized,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "حدث خطأ أثناء إرسال الرمز" };
    }
  };

  const verifyOtp = async (rawPhone: string, token: string) => {
    try {
      const normalized = normalizeSaudiPhone(rawPhone);
      if (!normalized) {
        return { success: false, error: "رقم الجوال غير صالح" };
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalized,
        token: token.trim(),
        type: "sms",
      });

      if (error || !data.user) {
        return {
          success: false,
          error: error?.message || "رمز التحقق غير صحيح أو منتهي الصلاحية",
        };
      }

      setUser(data.user);
      await loadProfileAndDriver(data.user.id);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "حدث خطأ أثناء التحقق" };
    }
  };

  const refreshDriver = async () => {
    if (user?.id) {
      await loadProfileAndDriver(user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setDriver(null);
  };

  return (
    <DriverAuthContext.Provider
      value={{
        user,
        profile,
        driver,
        loading,
        sendOtp,
        verifyOtp,
        refreshDriver,
        signOut,
      }}
    >
      {children}
    </DriverAuthContext.Provider>
  );
}

export function useDriverAuth() {
  const context = useContext(DriverAuthContext);
  if (!context) {
    throw new Error("useDriverAuth must be used within a DriverAuthProvider");
  }
  return context;
}
