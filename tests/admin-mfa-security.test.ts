import { describe, it, expect } from "vitest";
import { checkIsAAL2 } from "../apps/web/src/context/AdminAuthContext";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.SUPABASE_ANON_KEY || "";

describe("Security Check: MFA & AAL2 Protection (Step 2.1)", () => {
  it("ADM-001 / Security: checkIsAAL2 MUST strictly reject demo bypass flag when NODE_ENV is production", () => {
    // 1. حالة الإنتاج مع محاولة التجاوز بتخزين Mahallat_demo_aal2
    const isAal2InProdWithBypass = checkIsAAL2("aal1", true, "production");
    expect(isAal2InProdWithBypass).toBe(false);

    // 2. حالة الإنتاج بدون علامة ولا aal2
    const isAal2InProdWithoutBypass = checkIsAAL2("aal1", false, "production");
    expect(isAal2InProdWithoutBypass).toBe(false);

    // 3. حالة الإنتاج مع مطالبة null أو undefined
    expect(checkIsAAL2(null, true, "production")).toBe(false);
    expect(checkIsAAL2(undefined, true, "production")).toBe(false);
  });

  it("ADM-001 / Security: checkIsAAL2 ONLY allows true AAL2 when Supabase cryptographic claim is aal2", () => {
    // في الإنتاج، الرمز الحقيقي الصادر من Supabase Auth TOTP يعطي aal2
    const isRealTotpInProd = checkIsAAL2("aal2", false, "production");
    expect(isRealTotpInProd).toBe(true);

    const isRealTotpWithFlagInProd = checkIsAAL2("aal2", true, "production");
    expect(isRealTotpWithFlagInProd).toBe(true);
  });

  it("ADM-001 / Security: checkIsAAL2 allows demo convenience strictly in development mode", () => {
    // في التطوير فقط مع وجود العلامة
    const isDevWithFlag = checkIsAAL2("aal1", true, "development");
    expect(isDevWithFlag).toBe(true);

    // في التطوير بدون العلامة وبدون aal2
    const isDevWithoutFlag = checkIsAAL2("aal1", false, "development");
    expect(isDevWithoutFlag).toBe(false);
  });

  it("ADM-001 / Security: Database level check ensures non-AAL2 sessions cannot execute admin updates", async () => {
    if (!supabaseUrl || !anonKey) {
      console.warn("Supabase credentials missing, skipping DB integration check");
      return;
    }

    const anonClient = createClient(supabaseUrl, anonKey);

    // محاولة استدعاء دالة تحديث الإعدادات الإدارية بدون تسجيل AAL2
    const { data, error } = await anonClient.rpc("admin_update_setting", {
      p_key: "product_max_prep_time_minutes",
      p_new_value: "35",
      p_reason: "محاولة غير مصرحة بدون خطوة ثانية",
    });

    // يجب أن تفشل قطعياً برفض أمني
    expect(error).toBeDefined();
    expect(data).toBeNull();
  });
});
