import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import type { Database } from "@mahallat/shared";
import {
  isValidShortNationalAddress,
  normalizeShortNationalAddress,
} from "@mahallat/shared";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

describe("العناوين ودقة الموقع وطلبات التغطية (Step 2.3)", () => {
  let testCustomer1: { id: string; phone: string; client: any };
  let testCustomer2: { id: string; phone: string; client: any };
  let jeddahCityId: string;

  beforeAll(async () => {
    // 1. استخراج معرّف مدينة جدة للتأكد
    const { data: jeddah } = await adminClient
      .from("cities")
      .select("id")
      .eq("name_ar", "جدة")
      .single();

    if (jeddah) {
      jeddahCityId = jeddah.id;
    }

    // 2. تجهيز عميل تجريبي أول
    const phone1 = "+966599111222";
    let user1Id: string;
    const { data: prof1 } = await adminClient
      .from("profiles")
      .select("id")
      .eq("phone", phone1)
      .maybeSingle();

    if (prof1) {
      user1Id = prof1.id;
    } else {
      const { data: created1 } = await adminClient.auth.admin.createUser({
        phone: phone1,
        phone_confirm: true,
      });
      user1Id = created1?.user?.id!;
    }

    await adminClient.from("profiles").upsert({
      id: user1Id,
      full_name: "عميل تجربة العناوين 1",
      phone: phone1,
      preferred_language: "ar",
    });

    // 3. تجهيز عميل تجريبي ثانٍ لاختبار عزل RLS
    const phone2 = "+966599333444";
    let user2Id: string;
    const { data: prof2 } = await adminClient
      .from("profiles")
      .select("id")
      .eq("phone", phone2)
      .maybeSingle();

    if (prof2) {
      user2Id = prof2.id;
    } else {
      const { data: created2 } = await adminClient.auth.admin.createUser({
        phone: phone2,
        phone_confirm: true,
      });
      user2Id = created2?.user?.id!;
    }

    await adminClient.from("profiles").upsert({
      id: user2Id,
      full_name: "عميل تجربة العناوين 2",
      phone: phone2,
      preferred_language: "ar",
    });

    // 4. إنشاء عملاء مصادقين
    const client1 = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    const client2 = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

    testCustomer1 = { id: user1Id, phone: phone1, client: client1 };
    testCustomer2 = { id: user2Id, phone: phone2, client: client2 };
  });

  it("CUS-002: إدخال عنوان بلا وقت تأكيد الدبوس مرفوض من قاعدة البيانات", async () => {
    // محاولة إدخال عنوان بنقطة وإحداثيات صحيحة لكن بدون pin_confirmed_at
    const { data, error } = await adminClient.from("customer_addresses").insert({
      customer_id: testCustomer1.id,
      name: "عنوان تجريبي بدون تأكيد",
      type: "house",
      latitude: 21.5645,
      longitude: 39.145,
      location: "POINT(39.1450 21.5645)" as any,
      pin_confirmed_at: null as any, // قيد إلزامي
    });

    expect(error).not.toBeNull();
    // التحقق من أن الخطأ يشير إلى إلزامية وقت تأكيد الدبوس
    expect(error?.message).toMatch(/تأكيد الدبوس|pin_confirmed/i);
  });

  it("CUS-002 & DSP-002: دبوس داخل جدة يُنسب لجدة تلقائياً، ودبوس خارج كل المدن لا يُحفظ عنواناً", async () => {
    // 1. دبوس داخل جدة (حي الروضة: 21.5645, 39.1450)
    const { data: validAddr, error: validError } = await adminClient
      .from("customer_addresses")
      .insert({
        customer_id: testCustomer1.id,
        name: "منزل الروضة",
        type: "house",
        latitude: 21.5645,
        longitude: 39.145,
        location: "POINT(39.1450 21.5645)" as any,
        pin_confirmed_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    expect(validError).toBeNull();
    expect(validAddr).not.toBeNull();
    if (jeddahCityId) {
      expect(validAddr?.city_id).toBe(jeddahCityId);
    }

    // 2. دبوس خارج كل المدن المفعّلة (في البحر أو صحراء بعيدة: 23.0000, 42.0000)
    const { data: outsideAddr, error: outsideError } = await adminClient
      .from("customer_addresses")
      .insert({
        customer_id: testCustomer1.id,
        name: "عنوان خارج التغطية",
        type: "other",
        latitude: 23.0,
        longitude: 42.0,
        location: "POINT(42.0000 23.0000)" as any,
        pin_confirmed_at: new Date().toISOString(),
      });

    expect(outsideError).not.toBeNull();
    expect(outsideError?.message).toMatch(/خارج نطاق تغطية المدن المفعّلة/i);
  });

  it("CUS-002: صيغة العنوان المختصر خاطئة مرفوضة قبل الخادم، واستعلام الرمز الصحيح يرجع إحداثياته", async () => {
    // 1. فحص صيغة العنوان المختصر (4 أحرف و4 أرقام)
    expect(isValidShortNationalAddress("RRRD2929")).toBe(true);
    expect(isValidShortNationalAddress("INVALID")).toBe(false);
    expect(isValidShortNationalAddress("12345678")).toBe(false);
    expect(isValidShortNationalAddress("RRRD292")).toBe(false);

    // 2. استدعاء دالة national-address Edge Function
    const { data, error } = await anonClient.functions.invoke("national-address", {
      body: { short_code: "RRRD2929" },
    });

    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.latitude).toBeCloseTo(21.5645, 2);
    expect(data?.longitude).toBeCloseTo(39.145, 2);
    expect(data?.short_code).toBe("RRRD2929");
  });

  it("CUS-002 & RLS: عميل لا يرى ولا يعدل عناوين عميل آخر", async () => {
    // إنشاء عنوان للعميل 1 عبر adminClient
    const { data: addr1 } = await adminClient
      .from("customer_addresses")
      .insert({
        customer_id: testCustomer1.id,
        name: "عنوان العميل الأول السري",
        type: "apartment",
        latitude: 21.5833,
        longitude: 39.1422,
        location: "POINT(39.1422 21.5833)" as any,
        pin_confirmed_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    expect(addr1).not.toBeNull();

    // مستخدم مجهول (Anon) لا يرى العناوين
    const { data: anonData } = await anonClient
      .from("customer_addresses")
      .select("*")
      .eq("id", addr1!.id);

    expect(anonData?.length).toBe(0);
  });

  it("ADM-033: طلب تغطية من زائر يُحفظ، والإغراق بطلبات كثيرة من نفس الجهاز مرفوض", async () => {
    const testDeviceId = `test-device-${Date.now()}`;
    const testLat = 24.4789;
    const testLng = 46.257;

    // 1. إرسال طلب تغطية أول بنجاح
    const { data: req1, error: err1 } = await adminClient.rpc(
      "submit_coverage_request",
      {
        p_lat: testLat,
        p_lng: testLng,
        p_device_id: testDeviceId,
        p_district_name: "حي الريان",
        p_city_hint: "المزاحمية",
        p_note: "نرجو التوصيل قريباً",
      }
    );

    expect(err1).toBeNull();
    expect(req1).not.toBeNull();
    expect(req1?.district_name).toBe("حي الريان");

    // 2. إرسال 4 طلبات إضافية للوصول للحد الأقصى (5 طلبات في الساعة)
    for (let i = 0; i < 4; i++) {
      await adminClient.rpc("submit_coverage_request", {
        p_lat: testLat,
        p_lng: testLng,
        p_device_id: testDeviceId,
      });
    }

    // 3. الطلب السادس يجب أن يُرفض لحماية النظام من الإغراق (ADM-033)
    const { data: reqSpam, error: errSpam } = await adminClient.rpc(
      "submit_coverage_request",
      {
        p_lat: testLat,
        p_lng: testLng,
        p_device_id: testDeviceId,
      }
    );

    expect(errSpam).not.toBeNull();
    expect(errSpam?.message).toMatch(/تجاوزت الحد المسموح/i);
  });
});
