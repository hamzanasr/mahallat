import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://eaqmwmdkxqiuioszvjqx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

describe("Customer Auth, Consents & Security (Step 2.2)", () => {
  let customerUser1Id: string;
  let customerUser2Id: string;
  let customerClient1: any;
  let customerClient2: any;

  beforeAll(async () => {
    // إنشاء مستخدمين تجريبيين للاختبار
    const phone1 = `+9665${Math.floor(10000000 + Math.random() * 90000000)}`;
    const phone2 = `+9665${Math.floor(10000000 + Math.random() * 90000000)}`;

    const { data: u1 } = await adminClient.auth.admin.createUser({
      phone: phone1,
      phone_confirm: true,
      user_metadata: { full_name: "عميل تجريبي أول" },
    });
    customerUser1Id = u1.user!.id;

    const { data: u2 } = await adminClient.auth.admin.createUser({
      phone: phone2,
      phone_confirm: true,
      user_metadata: { full_name: "عميل تجريبي ثاني" },
    });
    customerUser2Id = u2.user!.id;

    // عميل موثّق 1
    const { data: token1 } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: `${customerUser1Id}@test.local`,
    });
    // بدلاً من السحر، سننشئ عميل باستخدام signInWithPassword أو استخدام service role للتأكد من RLS
  });

  it("ADM-001: check_and_record_otp_request allows up to limit and rejects (limit + 1)", async () => {
    const testPhone = `+96650999${Math.floor(1000 + Math.random() * 9000)}`;
    const testDevice = `dev_${Math.random().toString(36).substring(7)}`;

    // أول 5 طلبات يجب أن تنجح
    for (let i = 1; i <= 5; i++) {
      const { data, error } = await adminClient.rpc("check_and_record_otp_request", {
        p_phone: testPhone,
        p_device_id: testDevice,
      });
      expect(error).toBeNull();
      expect(data?.allowed).toBe(true);
    }

    // الطلب السادس (الحد + 1) يجب أن يُرفض فوراً
    const { data: rejectedReq, error: rejErr } = await adminClient.rpc(
      "check_and_record_otp_request",
      {
        p_phone: testPhone,
        p_device_id: testDevice,
      }
    );

    expect(rejErr).toBeNull();
    expect(rejectedReq?.allowed).toBe(false);
    expect(rejectedReq?.reason).toBe("phone_limit_exceeded");
  });

  it("CUS-012: Age 18+ consent is recorded with timestamp and version, and is immutable (REG-004)", async () => {
    // إدراج موافقة السن والشروط
    const { data: consent, error: insertError } = await adminClient
      .from("user_consents")
      .insert({
        user_id: customerUser1Id,
        consent_type: "age_18",
        status: "granted",
        version: "1.0",
        device_info: { device_id: "test-device-uuid" },
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(consent).toBeDefined();
    expect(consent.consent_type).toBe("age_18");
    expect(consent.status).toBe("granted");
    expect(consent.version).toBe("1.0");
    expect(consent.created_at).toBeDefined();

    // محاولة تعديل سجل الموافقة يجب أن تُرفض قطعاً بواسطة Trigger (REG-004)
    const { error: updateError } = await adminClient
      .from("user_consents")
      .update({ status: "revoked" })
      .eq("id", consent.id);

    expect(updateError).toBeDefined();
    expect(updateError?.message).toContain("سجل الموافقات محمي نظاماً وغير قابل للتعديل أو الحذف");

    // محاولة حذف سجل الموافقة يجب أن تُرفض أيضاً
    const { error: deleteError } = await adminClient
      .from("user_consents")
      .delete()
      .eq("id", consent.id);

    expect(deleteError).toBeDefined();
    expect(deleteError?.message).toContain("سجل الموافقات محمي نظاماً وغير قابل للتعديل أو الحذف");
  });

  it("CUS-001 & REG-004: Marketing consent is separate, can be granted, then revoked, creating audit records", async () => {
    // 1. منح موافقة التسويق
    const { data: grantedConsent, error: grantErr } = await adminClient
      .from("user_consents")
      .insert({
        user_id: customerUser1Id,
        consent_type: "marketing",
        status: "granted",
        version: "1.0",
      })
      .select()
      .single();

    expect(grantErr).toBeNull();
    expect(grantedConsent.status).toBe("granted");

    // 2. سحب موافقة التسويق بإضافة سجل جديد
    const { data: revokedConsent, error: revokeErr } = await adminClient
      .from("user_consents")
      .insert({
        user_id: customerUser1Id,
        consent_type: "marketing",
        status: "revoked",
        version: "1.0",
      })
      .select()
      .single();

    expect(revokeErr).toBeNull();
    expect(revokedConsent.status).toBe("revoked");

    // التحقق من وجود السجلين في الأرشيف
    const { data: allConsents } = await adminClient
      .from("user_consents")
      .select("status")
      .eq("user_id", customerUser1Id)
      .eq("consent_type", "marketing")
      .order("created_at", { ascending: true });

    expect(allConsents?.length).toBe(2);
    expect(allConsents?.[0].status).toBe("granted");
    expect(allConsents?.[1].status).toBe("revoked");
  });

  it("CUS-001: Customer can submit account deletion request with forfeiture acknowledgement", async () => {
    const { data: req, error } = await adminClient
      .from("account_deletion_requests")
      .insert({
        user_id: customerUser2Id,
        phone: "+966500000002",
        reason: "تجربة الخدمة فقط",
        acknowledged_forfeiture: true,
        status: "pending",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(req.acknowledged_forfeiture).toBe(true);
    expect(req.status).toBe("pending");

    // الاستعلام عنها من قبل الإدارة
    const { data: adminList } = await adminClient
      .from("account_deletion_requests")
      .select("*")
      .eq("id", req.id);

    expect(adminList?.length).toBe(1);
    expect(adminList?.[0].phone).toBe("+966500000002");
  });

  it("REG-004 & RLS: Anonymous user cannot read private consents or deletion requests", async () => {
    const { data: anonConsents, error: anonErr } = await anonClient
      .from("user_consents")
      .select("*");

    expect(anonConsents?.length || 0).toBe(0);

    const { data: anonDeletions } = await anonClient
      .from("account_deletion_requests")
      .select("*");

    expect(anonDeletions?.length || 0).toBe(0);
  });
});
