-- ==============================================================================
-- الخطوة 2.1: إعدادات ظهور وإخفاء الأقسام حسب المدينة (CUS-009)
-- الافتراضي: الصيدليات مخفية حتى تأكيد الاشتراطات النظامية، والبقية ظاهرة
-- ==============================================================================

INSERT INTO public.setting_definitions (key, name_ar, description_ar, type, default_value, allowed_levels, related_requirements)
VALUES
  (
    'section_restaurants_enabled',
    'إظهار قسم المطاعم',
    'التحكم في إظهار أو إخفاء قسم المطاعم في الصفحة الرئيسية لتطبيق العميل',
    'boolean',
    'true'::jsonb,
    '{"global", "city"}',
    '{"CUS-009"}'
  ),
  (
    'section_retail_enabled',
    'إظهار قسم المحلات المتنوعة',
    'التحكم في إظهار أو إخفاء قسم المحلات المتنوعة والمخابز في تطبيق العميل',
    'boolean',
    'true'::jsonb,
    '{"global", "city"}',
    '{"CUS-009"}'
  ),
  (
    'section_mart_enabled',
    'إظهار قسم المارت والسوبرماركت',
    'التحكم في إظهار أو إخفاء قسم المارت والتموينات السريعة في تطبيق العميل',
    'boolean',
    'true'::jsonb,
    '{"global", "city"}',
    '{"CUS-009"}'
  ),
  (
    'section_pharmacy_enabled',
    'إظهار قسم الصيدليات',
    'التحكم في إظهار أو إخفاء قسم الصيدليات (مخفي افتراضياً حتى استيفاء الاشتراطات النظامية)',
    'boolean',
    'false'::jsonb,
    '{"global", "city"}',
    '{"CUS-009", "PHR-001"}'
  ),
  (
    'section_self_pickup_enabled',
    'إظهار خدمة استلم بنفسك',
    'التحكم في إظهار أو إخفاء بلاطة خدمة الاستلام الذاتي من الفرع',
    'boolean',
    'true'::jsonb,
    '{"global", "city"}',
    '{"CUS-009", "EXT-006"}'
  ),
  (
    'section_taxi_enabled',
    'إظهار خدمة Taxi',
    'التحكم في إظهار أو إخفاء قسم تاكسي (صفحة قريباً) في تطبيق العميل',
    'boolean',
    'true'::jsonb,
    '{"global", "city"}',
    '{"CUS-009"}'
  )
ON CONFLICT (key) DO UPDATE
SET name_ar = EXCLUDED.name_ar,
    description_ar = EXCLUDED.description_ar,
    default_value = EXCLUDED.default_value,
    allowed_levels = EXCLUDED.allowed_levels,
    related_requirements = EXCLUDED.related_requirements;
