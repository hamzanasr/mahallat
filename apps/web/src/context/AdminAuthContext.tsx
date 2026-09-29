"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Database } from "@mahallat/shared";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AdminAuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  isSuperAdmin: boolean;
  isOperations: boolean;
  isFinance: boolean;
  isSupport: boolean;
  isAAL2: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// دالة فحص مستوى الخطوة الثانية (AAL2) لضمان استحالة التجاوز في بيئة الإنتاج
export function checkIsAAL2(
  aalClaim: string | null | undefined,
  isDemoFlagInStorage: boolean,
  nodeEnv: string = process.env.NODE_ENV
): boolean {
  // المستوى المعتمد دولياً ونظامياً من خادم Supabase
  if (aalClaim === "aal2") return true;
  // في بيئة التطوير فقط يُسمح بتجاوز الديمو لتسهيل الاختبار السريع للمطور
  if (nodeEnv === "development" && isDemoFlagInStorage) return true;
  // في بيئة الإنتاج يرفض تماماً أي تجاوز محلي
  return false;
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setUser(null);
      setSession(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    setUser(currentSession.user);
    setSession(currentSession);

    // جلب الأدوار للمستخدم
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", currentSession.user.id);

    const extractedRoles = (userRoles?.map((r) => r.role) || []) as AppRole[];
    setRoles(extractedRoles);
    setLoading(false);
  };

  const refreshAuth = async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    await fetchUserData(data.session);
  };

  useEffect(() => {
    // جلب الجلسة الحالية
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserData(session);
    });

    // الاستماع لتغييرات الجلسة
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserData(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
    if (typeof window !== "undefined") {
      window.location.href = "/admin/login";
    }
  };

  // التحقق من مستوى الخطوة الثانية (AAL2)
  const aalClaim = (session as any)?.aal || (session?.user as any)?.app_metadata?.aal || "aal1";
  const isDemoFlag = typeof window !== "undefined" && localStorage.getItem("mahallat_demo_aal2") === "true";
  const isAAL2 = checkIsAAL2(aalClaim, isDemoFlag, process.env.NODE_ENV);

  const isSuperAdmin = roles.includes("super_admin");
  const isOperations = roles.includes("operations") || isSuperAdmin;
  const isFinance = roles.includes("finance") || isSuperAdmin;
  const isSupport = roles.includes("support");

  const primaryRole: AppRole | null =
    roles.find((r) => r === "super_admin") ||
    roles.find((r) => r === "operations") ||
    roles.find((r) => r === "finance") ||
    roles.find((r) => r === "support") ||
    roles[0] ||
    null;

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        session,
        roles,
        primaryRole,
        isSuperAdmin,
        isOperations,
        isFinance,
        isSupport,
        isAAL2,
        loading,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}
