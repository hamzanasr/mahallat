import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// عناوين محاكاة لاختبار التطوير (في حال عدم ربط مفتاح واجهة العنوان الوطني الحكومية بعد)
const MOCK_ADDRESSES: Record<
  string,
  {
    latitude: number;
    longitude: number;
    district_name: string;
    city_name: string;
    street_name: string;
    building_number: string;
  }
> = {
  RRRD2929: {
    latitude: 21.5645,
    longitude: 39.145,
    district_name: "الروضة",
    city_name: "جدة",
    street_name: "شارع الكيال",
    building_number: "2929",
  },
  EJAA4120: {
    latitude: 21.5833,
    longitude: 39.1422,
    district_name: "الزهراء",
    city_name: "جدة",
    street_name: "شارع البترجي",
    building_number: "4120",
  },
  ABCD1234: {
    latitude: 21.5168,
    longitude: 39.155,
    district_name: "الحمراء",
    city_name: "جدة",
    street_name: "طريق الأندلس",
    building_number: "1234",
  },
  MUZM9999: {
    // خارج تغطية جدة (المزاحمية) لاختبار حالة «خارج التغطية» ADM-033
    latitude: 24.4789,
    longitude: 46.257,
    district_name: "حي الريان",
    city_name: "المزاحمية",
    street_name: "طريق الملك عبدالعزيز",
    building_number: "9999",
  },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawCode = (body?.short_code || body?.shortCode || "").toString().trim().toUpperCase();

    // 1. التحقق من صيغة العنوان الوطني المختصر (4 حروف لاتينية و4 أرقام)
    const SHORT_REGEX = /^[A-Z]{4}\d{4}$/;
    if (!SHORT_REGEX.test(rawCode)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message:
              "صيغة العنوان الوطني المختصر غير صحيحة. يجب أن تتكون من 4 أحرف إنجليزية و4 أرقام (مثال: RRRD2929).",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const splApiKey =
      Deno.env.get("SPL_API_KEY") ||
      Deno.env.get("NATIONAL_ADDRESS_API_KEY") ||
      "";

    // 2. إذا توفر مفتاح واجهة سبل / العنوان الوطني المعتمد
    if (splApiKey) {
      try {
        const splUrl = `https://apigateway.sp.com.sa/nationaladdress/v3.1/addresses/address-by-short-code?shortCode=${encodeURIComponent(
          rawCode
        )}&language=A`;

        const splRes = await fetch(splUrl, {
          method: "GET",
          headers: {
            "api-key": splApiKey,
            Accept: "application/json",
          },
        });

        if (splRes.ok) {
          const splData = await splRes.json();
          const firstAddr = splData?.Addresses?.[0] || splData?.[0];

          if (firstAddr && (firstAddr.Latitude || firstAddr.latitude)) {
            const lat = parseFloat(firstAddr.Latitude || firstAddr.latitude);
            const lng = parseFloat(firstAddr.Longitude || firstAddr.longitude);

            return new Response(
              JSON.stringify({
                success: true,
                latitude: lat,
                longitude: lng,
                district_name:
                  firstAddr.DistrictName || firstAddr.district || null,
                city_name: firstAddr.City || firstAddr.city || null,
                street_name:
                  firstAddr.StreetName || firstAddr.street || null,
                building_number:
                  firstAddr.BuildingNumber || firstAddr.building || null,
                short_code: rawCode,
                is_mock: false,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
      } catch (splErr) {
        console.warn("[national-address] خطأ أثناء الاتصال بواجهة العنوان الوطني:", splErr);
      }
    }

    // 3. بيئة الاختبار أو محاكاة الرموز النموذجية (المفتاح لم يُدخل بعد)
    if (MOCK_ADDRESSES[rawCode]) {
      const mock = MOCK_ADDRESSES[rawCode];
      return new Response(
        JSON.stringify({
          success: true,
          latitude: mock.latitude,
          longitude: mock.longitude,
          district_name: mock.district_name,
          city_name: mock.city_name,
          street_name: mock.street_name,
          building_number: mock.building_number,
          short_code: rawCode,
          is_mock: true,
          note: !splApiKey
            ? "تم جلب الإحداثيات عبر البيانات التجريبية؛ يرجى إضافة مفتاح SPL_API_KEY للربط الحي."
            : undefined,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // في حال عدم توفر المفتاح وعدم وجود الرمز في قائمة المحاكاة
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: splApiKey
            ? "لم يتم العثور على إحداثيات لهذا العنوان الوطني المختصر. يمكنك تحديد موقعك يدوياً على الخريطة."
            : "خدمة العنوان الوطني المختصر تتطلب إضافة مفتاح SPL_API_KEY من بوابة العنوان الوطني. يمكنك تحديد موقعك على الخريطة مباشرة.",
        },
      }),
      {
        status: splApiKey ? 404 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(
      JSON.stringify({
        success: false,
        error: { message: error?.message || "حدث خطأ غير متوقع" },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
