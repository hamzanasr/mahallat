"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../context/LanguageContext";
import { Shield, KeyRound, UserCheck, Lock, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    roleKey: "super_admin",
    name: "المدير العام (صلاحية كاملة)",
    email: "admin@mahallat.local",
    password: "DemoAdmin123!",
    badge: "Super Admin",
    color: "from-blue-600 to-indigo-700",
  },
  {
    roleKey: "operations",
    name: "إدارة العمليات والتشغيل",
    email: "ops@mahallat.local",
    password: "DemoAdmin123!",
    badge: "Operations",
    color: "from-emerald-600 to-teal-700",
  },
  {
    roleKey: "finance",
    name: "الإدارة المالية",
    email: "finance@mahallat.local",
    password: "DemoAdmin123!",
    badge: "Finance",
    color: "from-amber-600 to-orange-700",
  },
  {
    roleKey: "support",
    name: "خدمة العملاء والدعم (ممنوع مالياً)",
    email: "support@mahallat.local",
    password: "DemoAdmin123!",
    badge: "Support",
    color: "from-purple-600 to-pink-700",
  },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // حالة الخطوة الثانية MFA
  const [showMfaStep, setShowMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);

  // تعبئة بيانات حساب ديمو بنقرة واحدة
  const handleSelectDemo = (account: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrorMsg(null);
  };

  // تسجيل الدخول الأساسي (AAL1)
  const handlePasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("لم يتم العثور على بيانات المستخدم");
      }

      // فحص عوامل التحقق بخطوتين (MFA)
      const factorsRes = await supabase.auth.mfa.listFactors();
      const totpFactor = factorsRes.data?.totp?.[0];

      if (totpFactor) {
        // يوجد عامل TOTP مسجل مسبقاً -> طلب الرمز
        setFactorId(totpFactor.id);
        setShowMfaStep(true);
      } else {
        // لا يوجد عامل TOTP مسجل -> عرض شاشة التفعيل أو الدخول السريع
        const enrollRes = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Mahallat-Admin-${email}`,
        });

        if (enrollRes.data) {
          setFactorId(enrollRes.data.id);
          setMfaSecret(enrollRes.data.totp.secret);
          setQrCodeUrl(enrollRes.data.totp.qr_code);
        }
        setShowMfaStep(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  // التحقق من رمز TOTP والانتقال إلى AAL2
  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;

    setMfaLoading(true);
    setErrorMsg(null);

    try {
      // إنشاء تحدي ومصادقة
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: mfaCode.trim(),
      });

      if (verify.error) throw verify.error;

      // تم التحقق بنجاح والوصول لـ AAL2!
      localStorage.setItem("mahallat_demo_aal2", "true");
      router.push("/admin");
    } catch (err: any) {
      setErrorMsg("رمز المصادقة غير صحيح أو انتهت صلاحيته");
    } finally {
      setMfaLoading(false);
    }
  };

  // إكمال سريع لوضع الديمو (يمنح تجربة سريعة مع تخزين علامة AAL2)
  const handleInstantDemoMfa = () => {
    localStorage.setItem("mahallat_demo_aal2", "true");
    router.push("/admin");
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/20 mb-4 border border-blue-400/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t.admin.loginTitle}</h1>
          <p className="text-sm text-slate-400 mt-1">{t.admin.loginSubtitle}</p>
        </div>

        {/* بطاقة الحسابات التجريبية السريعة (Demo Accounts) */}
        {!showMfaStep && (
          <div className="mb-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <h2 className="text-sm font-semibold text-slate-200">{t.admin.demoAccounts}</h2>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">{t.admin.demoNotice}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.roleKey}
                  type="button"
                  onClick={() => handleSelectDemo(acc)}
                  className={`text-right p-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 hover:bg-slate-700/80 transition-all duration-200 text-xs flex flex-col justify-between group cursor-pointer ${
                    email === acc.email ? "ring-2 ring-blue-500 border-transparent bg-slate-800" : ""
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-medium text-slate-200 group-hover:text-white">{acc.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* بطاقة النموذج */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-red-950/60 border border-red-800/50 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!showMfaStep ? (
            /* الخطوة 1: كلمة المرور والإيميل */
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.admin.email}</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@mahallat.local"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.admin.password}</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-600/30 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>{t.admin.loginButton}</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* الخطوة 2: التحقق بخطوتين (AAL2 / TOTP) */
            <div className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mb-2 border border-emerald-500/20">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-white">{t.admin.mfaTitle}</h3>
                <p className="text-xs text-slate-400 mt-1">{t.admin.mfaSubtitle}</p>
              </div>

              {/* إذا كان هناك QR كود جديد للتسجيل */}
              {qrCodeUrl && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <p className="text-xs text-slate-300 mb-2">{t.admin.scanQr}</p>
                  <div className="flex justify-center my-2 bg-white p-2 rounded-lg max-w-[160px] mx-auto">
                    <img src={qrCodeUrl} alt="TOTP QR Code" className="w-36 h-36" />
                  </div>
                  {mfaSecret && (
                    <div className="mt-2 text-[11px] font-mono text-slate-400 bg-slate-900 py-1 px-2 rounded border border-slate-800 select-all">
                      {mfaSecret}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleVerifyMfa} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.admin.mfaCode}</label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-center font-mono text-xl tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={mfaLoading || mfaCode.length < 6}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-emerald-600/30 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {mfaLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t.admin.verifyMfa}</span>
                    </>
                  )}
                </button>
              </form>

              {/* زر الدخول السريع في وضع الديمو */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleInstantDemoMfa}
                  className="w-full py-2 px-3 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.admin.instantDemoMfa}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 mt-6 font-mono">
          Mahallat Platform · Enterprise Multi-Tenant Delivery
        </p>
      </div>
    </div>
  );
}
