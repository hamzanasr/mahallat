-- ==============================================================================
-- ملف البيانات التجريبية الشاملة (supabase/seed/demo_data.sql)
-- الخطوة 1.6: مدينة جدة، والمتاجر النموذجية، والفروع، وقوائم الطعام
-- ملاحظة: يمكن تشغيل هذا الملف أو تشغيل السكربت الآلي: npm run db:seed-demo
-- ==============================================================================

-- 1. تصنيفات المتاجر التأسيسية
INSERT INTO public.store_categories (name_ar, name_en, section_key, sort_order, is_active)
VALUES
  ('وجبات سريعة وشاورما', 'Fast Food & Shawarma', 'fast_food', 1, true),
  ('برجر ومشويات', 'Burgers & Grills', 'burgers', 2, true),
  ('بيتزا وفطائر', 'Pizza & Pastries', 'pizza', 3, true),
  ('سوبرماركت وتموينات', 'Supermarket & Groceries', 'mart', 4, true),
  ('صيدليات وعناية', 'Pharmacies & Care', 'pharmacy', 5, true),
  ('مخابز ومتاجر متنوعة', 'Bakeries & Retail', 'retail', 6, true)
ON CONFLICT DO NOTHING;

-- 2. التاجر التجريبي الأساسي وحسابه البنكي
INSERT INTO public.merchants (id, commercial_name, cr_number, vat_number, contact_name, contact_phone, contact_email)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'مجموعة مطاعم الساحل الغربي (ديمو)', '4030123456', '300012345600003', 'خالد الغامدي', '+966500123456', 'merchant.demo@mahallat.local')
ON CONFLICT (id) DO UPDATE
SET commercial_name = EXCLUDED.commercial_name;

INSERT INTO public.merchant_bank_accounts (merchant_id, bank_name, iban, beneficiary_name, is_verified)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'البنك الأهلي السعودي (SNB)', 'SA4400000000123456789012', 'مجموعة مطاعم الساحل الغربي', true)
ON CONFLICT (merchant_id) DO UPDATE
SET iban = EXCLUDED.iban;

-- 3. المتاجر الستة التجريبية (جدة)
-- متجر 1: شاورما وفلافل الساحل (ديمو) - متعاقد بمنيو - عقد نسبة 10%
INSERT INTO public.stores (
  id, merchant_id, name_ar, name_en, store_type, operation_type,
  min_order_halalas, default_prep_time_minutes, can_exceed_max_prep_time,
  menu_permission, menu_price_tolerance_percentage, self_pickup_enabled,
  menu_slug
)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'شاورما وفلافل الساحل (ديمو)',
  'Coast Shawarma & Falafel (Demo)',
  'contracted_menu',
  'restaurant',
  1500,
  18,
  false,
  'review_required',
  5.0,
  true,
  'coast-shawarma-demo'
)
ON CONFLICT (id) DO NOTHING;

-- متجر 2: برجر ومشويات الأندلس (ديمو) - متعاقد بمنيو - عقد رسوم لكل عميل
INSERT INTO public.stores (
  id, merchant_id, name_ar, name_en, store_type, operation_type,
  min_order_halalas, default_prep_time_minutes, can_exceed_max_prep_time,
  menu_permission, menu_price_tolerance_percentage, self_pickup_enabled,
  menu_slug
)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'برجر ومشويات الأندلس (ديمو)',
  'Alandalus Burger & Grills (Demo)',
  'contracted_menu',
  'restaurant',
  2000,
  22,
  false,
  'price_tolerance',
  7.0,
  true,
  'alandalus-burger-demo'
)
ON CONFLICT (id) DO NOTHING;

-- متجر 3: بيتزا وفطائر نابولي (ديمو) - متعاقد بمنيو - بدون عمولة وزيادة منيو 10%
INSERT INTO public.stores (
  id, merchant_id, name_ar, name_en, store_type, operation_type,
  min_order_halalas, default_prep_time_minutes, can_exceed_max_prep_time,
  menu_permission, menu_price_tolerance_percentage, self_pickup_enabled,
  menu_slug
)
VALUES (
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'بيتزا وفطائر نابولي (ديمو)',
  'Napoli Pizza & Pastries (Demo)',
  'contracted_menu',
  'restaurant',
  2500,
  25,
  false,
  'full',
  10.0,
  true,
  'napoli-pizza-demo'
)
ON CONFLICT (id) DO NOTHING;

-- متجر 4: تموينات وسوبرماركت المروة (ديمو) - نشاط مارت
INSERT INTO public.stores (
  id, merchant_id, name_ar, name_en, store_type, operation_type,
  min_order_halalas, default_prep_time_minutes, can_exceed_max_prep_time,
  menu_permission, menu_price_tolerance_percentage, self_pickup_enabled,
  menu_slug
)
VALUES (
  'b0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000001',
  'تموينات وسوبرماركت المروة (ديمو)',
  'Al Marwah Supermarket (Demo)',
  'contracted_menu',
  'mart',
  1000,
  15,
  false,
  'review_required',
  5.0,
  true,
  'almarwah-market-demo'
)
ON CONFLICT (id) DO NOTHING;

-- متجر 5: صيدلية النور والمستلزمات الطبية (ديمو) - متعاقد كتابة فقط (بلا منيو)
INSERT INTO public.stores (
  id, merchant_id, name_ar, name_en, store_type, operation_type,
  min_order_halalas, default_prep_time_minutes, can_exceed_max_prep_time,
  menu_permission, menu_price_tolerance_percentage, self_pickup_enabled,
  menu_slug
)
VALUES (
  'b0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000001',
  'صيدلية النور والمستلزمات الطبية (ديمو)',
  'Al Noor Pharmacy (Demo)',
  'contracted_text_only',
  'pharmacy',
  1500,
  15,
  false,
  'review_required',
  5.0,
  true,
  'alnoor-pharmacy-demo'
)
ON CONFLICT (id) DO NOTHING;

-- متجر 6: مخبز وتموينات البلد التاريخية (ديمو) - غير متعاقد (بلا منيو)
INSERT INTO public.stores (
  id, merchant_id, name_ar, name_en, store_type, operation_type,
  min_order_halalas, default_prep_time_minutes, can_exceed_max_prep_time,
  menu_permission, menu_price_tolerance_percentage, self_pickup_enabled,
  menu_slug
)
VALUES (
  'b0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000001',
  'مخبز وتموينات البلد التاريخية (ديمو)',
  'Al Balad Bakery & Retail (Demo)',
  'uncontracted',
  'retail',
  0,
  15,
  false,
  'review_required',
  0.0,
  false,
  'albalad-bakery-demo'
)
ON CONFLICT (id) DO NOTHING;
