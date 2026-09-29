-- ==============================================================================
-- ملف البيانات الأولية (seed.sql)
-- تعبئة تعريفات الإعدادات المرنة والقيم الافتراضية طبقاً لـ docs/spec/32-settings.md
-- ==============================================================================

INSERT INTO public.setting_definitions (key, name_ar, description_ar, type, min_value, max_value, default_value, allowed_levels, related_requirements, options)
VALUES
  ('order_cancellation_grace_period_seconds', 'مهلة التراجع بعد الدفع', 'المهلة الزمنية بالثواني المتاحة للعميل لإلغاء طلبه بعد الدفع فوراً', 'duration_seconds', 0, 300, '60'::jsonb, '{"global"}', '{"ORD-001"}', NULL),
  ('merchant_prep_time_edit_window_minutes', 'مهلة تعديل مدة التحضير', 'المهلة المتاحة للتاجر لتعديل مدة التحضير المقترحة بالدقائق', 'duration_minutes', 1, 15, '3'::jsonb, '{"global"}', '{"MER-009"}', NULL),
  ('merchant_prep_time_max_edits', 'أقصى عدد لتعديلات مدة التحضير', 'عدد المرات المسموح فيها للتاجر بتعديل مدة التحضير للطلب الواحد', 'number', 1, 5, '1'::jsonb, '{"global"}', '{"MER-009"}', NULL),
  ('product_max_prep_time_minutes', 'الحد الأعلى لمدة تحضير منتج', 'أقصى مدة تحضير يمكن للتاجر تحديدها للمنتج الواحد', 'duration_minutes', 5, 120, '40'::jsonb, '{"global", "store"}', '{"MER-009"}', NULL),
  ('store_max_prep_time_minutes', 'الحد الأعلى العام لتحضير المتجر', 'أقصى مدة تحضير مسموحة للمتجر ككل قبل احتساب التأخير', 'duration_minutes', 10, 180, '40'::jsonb, '{"global", "store"}', '{"MER-009"}', NULL),
  ('busy_mode_max_added_minutes', 'الزيادة القصوى لوضع الانشغال', 'أقصى دقائق إضافية يضيفها المتجر على مدة التحضير أثناء الانشغال', 'duration_minutes', 5, 60, '15'::jsonb, '{"global"}', '{"MER-046"}', NULL),
  ('busy_mode_max_duration_minutes', 'المدة القصوى لتفعيل وضع الانشغال', 'الحد الأقصى بالدقائق لبقاء المتجر في وضع الانشغال قبل العودة للوضع الطبيعي', 'duration_minutes', 15, 240, '60'::jsonb, '{"global"}', '{"MER-046"}', NULL),
  ('driver_pickup_early_alert_minutes', 'تنبيه المندوب للاستلام مبكراً', 'إرسال تنبيه للمندوب بالتوجه للمتجر قبل نهاية التحضير بعدد من الدقائق', 'duration_minutes', 1, 20, '5'::jsonb, '{"global"}', '{"DRV-003"}', NULL),
  ('merchant_delay_grace_minutes', 'مهلة سماح تأخر التاجر', 'المهلة بعد انتهاء وقت التحضير قبل بدء فرض غرامة التأخير', 'duration_minutes', 0, 30, '10'::jsonb, '{"global"}', '{"MER-040"}', NULL),
  ('merchant_delay_fine_percentage', 'نسبة غرامة تأخر التاجر', 'نسبة الخصم من قيمة المنتجات عند تجاوز مهلة السماح', 'percentage', 0.0, 50.0, '10.0'::jsonb, '{"global"}', '{"MER-040"}', NULL),
  ('merchant_delay_fine_max_halalas', 'سقف غرامة تأخر التاجر بالهللة', 'الحد الأقصى لغرامة تأخر التاجر بالهللة (500 هللة = 5 ر.س)', 'amount_halalas', 0, 5000, '500'::jsonb, '{"global"}', '{"MER-040"}', NULL),
  ('driver_delay_penalty_percentage_per_minute', 'خصم تأخر المندوب لكل دقيقة', 'نسبة الخصم من المنتجات لكل دقيقة تأخير للمندوب', 'percentage', 0.0, 5.0, '1.0'::jsonb, '{"global"}', '{"DRV-008"}', NULL),
  ('driver_delay_penalty_max_halalas', 'سقف خصم تأخر المندوب بالهللة', 'أقصى مبلغ خصم تأخير على المندوب بالهللة', 'amount_halalas', 0, 10000, '2000'::jsonb, '{"global"}', '{"DRV-008"}', NULL),
  ('delivery_time_buffer_minutes', 'هامش وقت التوصيل المسموح', 'الدقائق المضافة لوقت خرائط جوجل لتحديد وقت التوصيل الأقصى', 'duration_minutes', 0, 30, '5'::jsonb, '{"global"}', '{"DSP-001"}', NULL),
  ('customer_display_prep_buffer_minutes', 'إضافة التحضير المعروضة للعميل', 'دقائق إضافية تُزاد ظاهرياً على وقت التحضير لطمأنة العميل وتفادي خيبة الأمل', 'duration_minutes', 0, 20, '5'::jsonb, '{"global"}', '{"CUS-005"}', NULL),
  ('customer_display_delivery_buffer_minutes', 'إضافة التوصيل المعروضة للعميل', 'دقائق إضافية تُزاد ظاهرياً على وقت التوصيل للعميل', 'duration_minutes', 0, 20, '5'::jsonb, '{"global"}', '{"CUS-005"}', NULL),
  ('geofence_arrival_radius_meters', 'نطاق الوصول الجغرافي بالأمتار', 'نصف قطر دائرة التحقق الجغرافي لاعتبار المندوب وصل للمتجر أو العميل', 'number', 20, 500, '100'::jsonb, '{"global"}', '{"DSP-002"}', NULL),
  ('driver_wait_before_alert_minutes', 'انتظار المندوب قبل تنبيه العميل', 'المدة بالدقائق بعد وصول المندوب ومحاولة الاتصال قبل إرسال التنبيه الرسمي', 'duration_minutes', 1, 15, '5'::jsonb, '{"global"}', '{"DRV-005"}', NULL),
  ('unresponsive_auto_complete_minutes', 'الإنهاء التلقائي لعدم التجاوب', 'مدة انتظار المندوب عند العميل قبل إغلاق الطلب تلقائياً لعدم التجاوب', 'duration_minutes', 10, 60, '30'::jsonb, '{"global"}', '{"ORD-008"}', NULL),
  ('meet_driver_alert_distance_meters', 'مسافة إشعار التقِ بالمندوب بالأمتار', 'المسافة بين المندوب والعميل التي يُرسل عندها إشعار الاستعداد للقاء المندوب', 'number', 200, 3000, '1000'::jsonb, '{"global"}', '{"CUS-007"}', NULL),
  ('driver_max_batch_orders', 'أقصى عدد طلبات مجمعة للمندوب', 'الحد الأقصى للطلبات المتزامنة التي يحملها مندوب واحد في رحلة واحدة', 'number', 1, 5, '3'::jsonb, '{"global"}', '{"DSP-003"}', NULL),
  ('driver_batch_order_cluster_meters', 'نطاق تجميع الطلبات بالأمتار', 'أقصى مسافة مسموحة بين العملاء لتجميع طلباتهم مع مندوب واحد', 'number', 200, 5000, '1000'::jsonb, '{"global"}', '{"DSP-003"}', NULL),
  ('unassigned_order_ops_alert_minutes', 'مهلة تنبيه العمليات لطلب بلا مندوب', 'المدة بالدقائق بعد قبول الطلب دون إسناده لمندوب قبل إشعار غرفة العمليات', 'duration_minutes', 1, 15, '5'::jsonb, '{"global"}', '{"DSP-001"}', NULL),
  ('unassigned_order_auto_cancel_minutes', 'مهلة إلغاء طلب بلا مندوب تلقائياً', 'المدة بالدقائق قبل إلغاء الطلب آلياً أو تحويله لاستلام ذاتي', 'duration_minutes', 5, 60, '15'::jsonb, '{"global"}', '{"DSP-001"}', NULL),
  ('driver_cancel_before_prep_fine_halalas', 'غرامة إلغاء المندوب قبل التجهيز', 'مبلغ الغرامة بالهللة على المندوب عند إلغائه لطلب بعد قبوله وقبل تجهيزه', 'amount_halalas', 0, 2000, '500'::jsonb, '{"global"}', '{"DRV-010"}', NULL),
  ('driver_security_deposit_halalas', 'مبلغ تأمين المندوب بالهللة', 'مبلغ التأمين المسترد المشروط لتفعيل حساب المندوب (100 ر.س = 10000 هللة)', 'amount_halalas', 0, 50000, '10000'::jsonb, '{"global"}', '{"DRV-001"}', NULL),
  ('customer_complaint_window_hours', 'مهلة شكوى العميل بالدقائق', 'المدة الزمنية بعد تسليم الطلب المتاحة للعميل لتقديم شكوى أو طلب استرداد', 'duration_minutes', 15, 240, '60'::jsonb, '{"global"}', '{"SUP-001"}', NULL),
  ('merchant_dispute_window_days', 'مهلة اعتراض التاجر بالأيام', 'المدة المتاحة للتاجر للاعتراض على التسوية أو التحويل المالي', 'number', 1, 30, '7'::jsonb, '{"global"}', '{"MER-015"}', NULL),
  ('reward_claim_expiry_hours', 'مهلة استلام المكافأة بالساعات', 'المهلة الزمنية المتاحة للعميل للضغط على استلام المكافأة قبل سقوطها', 'number', 1, 72, '24'::jsonb, '{"global"}', '{"MKT-003"}', NULL),
  ('promotional_credit_validity_days', 'صلاحية الرصيد الترويجي بالأيام', 'عدد الأيام قبل انتهاء صلاحية رصيد المحفظة الترويجي أو التعويضي', 'number', 1, 90, '14'::jsonb, '{"global"}', '{"PAY-008"}', NULL),
  ('referral_reward_credit_halalas', 'مكافأة دعوة صديق بالهللة', 'قيمة الرصيد الترويجي الممنوح لكل طرف بعد أول طلب مكتمل للمدعو', 'amount_halalas', 0, 5000, '1000'::jsonb, '{"global", "city"}', '{"MKT-001"}', NULL),
  ('loyalty_platform_net_percentage', 'نسبة نقاط الولاء من صافي المنصة', 'النسبة المئوية من ربح المنصة الصافي المحولة إلى نقاط ولاء للعميل', 'percentage', 0.0, 30.0, '10.0'::jsonb, '{"global", "city"}', '{"MKT-004"}', NULL),
  ('loyalty_points_per_riyal', 'معادل نقاط الولاء لكل ريال', 'عدد النقاط المطلوب جمعها لاستبدالها بريال واحد رصيد', 'number', 10, 1000, '100'::jsonb, '{"global", "city"}', '{"MKT-004"}', NULL),
  ('loyalty_min_redemption_points', 'الحد الأدنى لاستبدال نقاط الولاء', 'أقل رصيد نقاط يمكن للعميل البدء باستبداله', 'number', 100, 5000, '500'::jsonb, '{"global", "city"}', '{"MKT-004"}', NULL),
  ('loyalty_points_expiry_days', 'صلاحية نقاط الولاء بالأيام', 'المدة قبل سقوط نقاط الولاء غير المستبدلة', 'number', 30, 365, '90'::jsonb, '{"global", "city"}', '{"MKT-004"}', NULL),
  ('allow_coupon_with_wallet_credit', 'السماح بدمج الكوبون مع المحفظة', 'هل يُسمح بتطبيق كود الخصم والدفع بالرصيد الترويجي في نفس الطلب', 'boolean', NULL, NULL, 'true'::jsonb, '{"global"}', '{"MKT-002"}', NULL),
  ('customer_service_fee_type', 'نوع رسم الخدمة على العميل', 'تحديد ما إذا كان رسم الخدمة نسبة أو مبلغ ثابت', 'select', NULL, NULL, '"percentage"'::jsonb, '{"global", "city"}', '{"PAY-002"}', '["percentage", "fixed"]'::jsonb),
  ('customer_service_fee_percentage', 'نسبة رسم الخدمة على العميل', 'النسبة المئوية المحتسبة من قيمة المنتجات والتوصيل كرسم خدمة للمنصة', 'percentage', 0.0, 10.0, '2.5'::jsonb, '{"global", "city"}', '{"PAY-002"}', NULL),
  ('customer_service_fee_fixed_halalas', 'رسم الخدمة الثابت على العميل بالهللة', 'المبلغ الثابت المحتسب كرسم خدمة عند اختيار النوع الثابت', 'amount_halalas', 0, 2000, '0'::jsonb, '{"global", "city"}', '{"PAY-002"}', NULL),
  ('store_contract_type', 'نوع عقد المتجر الافتراضي', 'نوع النموذج التجاري المعتمد للمتجر', 'select', NULL, NULL, '"per_customer"'::jsonb, '{"global", "store"}', '{"MER-001"}', '["per_customer", "percentage", "no_commission"]'::jsonb),
  ('tier1_order_threshold_halalas', 'حد الطلب الصغير لشريحة العميل بالهللة', 'قيمة الطلب الفاصلة بين الشريحة الأولى والثانية في عقد عميل المتجر', 'amount_halalas', 500, 10000, '2500'::jsonb, '{"global", "store"}', '{"MER-001"}', NULL),
  ('tier1_fee_halalas', 'رسم الشريحة الأولى بالهللة', 'الرسم المحتسب على التاجر لطلب العميل الأقل من الحد (2 ر.س = 200 هللة)', 'amount_halalas', 0, 1000, '200'::jsonb, '{"global", "store"}', '{"MER-001"}', NULL),
  ('tier2_fee_halalas', 'رسم الشريحة الثانية بالهللة', 'الرسم المحتسب على التاجر لطلب العميل البالغ الحد فأكثر (5 ر.س = 500 هللة)', 'amount_halalas', 0, 2000, '500'::jsonb, '{"global", "store"}', '{"MER-001"}', NULL),
  ('contract_per_customer_cap_halalas', 'سقف الرسوم لكل عميل عند المتجر', 'أقصى إجمالي رسوم تُخصم من المتجر على نفس العميل سنوياً (30 ر.س = 3000 هللة)', 'amount_halalas', 0, 10000, '3000'::jsonb, '{"global", "store"}', '{"MER-001"}', NULL),
  ('contract_per_customer_period_days', 'مدة احتساب سقف عميل المتجر بالأيام', 'المدة الزمنية لسريان سقف العميل (سنة كاملة = 365 يوماً)', 'number', 30, 730, '365'::jsonb, '{"global", "store"}', '{"MER-001"}', NULL),
  ('store_contract_percentage', 'نسبة العقد الافتراضية للنوع الثاني', 'نسبة العمولة المئوية المخصومة من قيمة المنتجات للمتجر', 'percentage', 0.0, 30.0, '10.0'::jsonb, '{"global", "store"}', '{"MER-001"}', NULL),
  ('menu_price_markup_percentage', 'الزيادة على سعر المنيو', 'نسبة الزيادة المطبقة على أسعار قائمة الطعام داخل التطبيق', 'percentage', 0.0, 25.0, '0.0'::jsonb, '{"global", "store"}', '{"MER-025"}', NULL),
  ('menu_markup_platform_share_percentage', 'حصة المنصة من زيادة المنيو', 'نسبة اقتسام الزيادة لصالح المنصة (المتبقي لصالح التاجر)', 'percentage', 0.0, 100.0, '100.0'::jsonb, '{"global", "store"}', '{"MER-025"}', NULL),
  ('payment_gateway_fee_percentage', 'نسبة رسم بوابة الدفع', 'النسبة المئوية المخصومة لصالح مزود الدفع الإلكتروني (ميسر)', 'percentage', 0.0, 5.0, '2.5'::jsonb, '{"global"}', '{"PAY-001"}', NULL),
  ('payment_gateway_fee_fixed_halalas', 'رسم بوابة الدفع الثابت بالهللة', 'المبلغ الثابت لكل عملية دفع إلكتروني (1 ر.س = 100 هللة)', 'amount_halalas', 0, 500, '100'::jsonb, '{"global"}', '{"PAY-001"}', NULL),
  ('mart_pharmacy_merchant_percentage', 'نسبة المارت والصيدليات على التاجر', 'نسبة الخصم من السعر الأصلي للتاجر في المارت والصيدليات', 'percentage', 0.0, 20.0, '5.0'::jsonb, '{"global", "store"}', '{"MER-001"}', NULL),
  ('mart_pharmacy_customer_markup_percentage', 'زيادة المارت والصيدليات على العميل', 'نسبة الزيادة الإضافية على سعر العميل في المارت والصيدليات', 'percentage', 0.0, 20.0, '5.0'::jsonb, '{"global", "store"}', '{"MER-001"}', NULL),
  ('text_orders_platform_fee_percentage', 'نسبة المنصة في طلبات الكتابة', 'النسبة المضافة على فاتورة طلبات الكتابة لصالح المنصة', 'percentage', 0.0, 20.0, '5.0'::jsonb, '{"global", "store"}', '{"ORD-010"}', NULL),
  ('self_pickup_discount_percentage', 'خصم الاستلام الذاتي', 'نسبة الخصم التشجيعي الممنوح للعميل عند اختيار الاستلام الذاتي', 'percentage', 0.0, 30.0, '0.0'::jsonb, '{"global", "store"}', '{"ORD-003"}', NULL),
  ('self_pickup_ops_alert_minutes', 'تنبيه استلام ذاتي غير مستلم بالدقائق', 'المدة بعد جاهزية الطلب قبل إشعار غرفة العمليات بعدم حضور العميل', 'duration_minutes', 15, 180, '60'::jsonb, '{"global"}', '{"ORD-003"}', NULL),
  ('delivery_base_fee_halalas', 'رسم التوصيل الأساسي بالهللة', 'أجرة التوصيل الثابتة للمسافة الأساسية الأولى (12 ر.س = 1200 هللة)', 'amount_halalas', 0, 5000, '1200'::jsonb, '{"global", "city", "store"}', '{"DSP-002"}', NULL),
  ('delivery_base_distance_km', 'مسافة التوصيل الأساسية بالكيلومتر', 'المسافة المغطاة برسم التوصيل الأساسي قبل احتساب الزيادة الكيلومترية', 'number', 1, 20, '5'::jsonb, '{"global", "city", "store"}', '{"DSP-002"}', NULL),
  ('delivery_per_km_fee_halalas', 'رسم التوصيل لكل كيلومتر إضافي بالهللة', 'المبلغ المضاف لكل كم يتجاوز المسافة الأساسية (1.5 ر.س = 150 هللة)', 'amount_halalas', 0, 1000, '150'::jsonb, '{"global", "city", "store"}', '{"DSP-002"}', NULL),
  ('platform_driver_commission_percentage', 'نسبة المنصة من توصيل المناديب', 'النسبة المقتطعة من أجر توصيل المندوب لصالح المنصة', 'percentage', 0.0, 30.0, '10.0'::jsonb, '{"global", "city"}', '{"DRV-001"}', NULL),
  ('vat_percentage', 'نسبة ضريبة القيمة المضافة', 'نسبة ضريبة القيمة المضافة النظامية المعتمدة', 'percentage', 0.0, 30.0, '15.0'::jsonb, '{"global"}', '{"ADM-034"}', NULL),
  ('uncontracted_service_fee_halalas', 'رسوم خدمة غير المتعاقد و اطلب اللي تبي بالهللة', 'رسم الخدمة الثابت لطلبات الشراء غير المباشر (5 ر.س = 500 هللة)', 'amount_halalas', 0, 2000, '500'::jsonb, '{"global"}', '{"ORD-011"}', NULL),
  ('flash_deal_min_discount_percentage', 'الحد الأدنى لخصم عرض الساعة', 'أقل نسبة خصم يقدمها المتجر ليدخل ضمن قسم عرض الساعة', 'percentage', 10.0, 90.0, '50.0'::jsonb, '{"global"}', '{"MKT-005"}', NULL),
  ('taxi_driver_max_cancels_before_ban', 'سقف إلغاءات سائق Taxi قبل الحظر', 'عدد مرات الإلغاء بعد القبول التي توجب حظر السائق مؤقتاً', 'number', 1, 10, '3'::jsonb, '{"global"}', '{"TAX-001"}', NULL),
  ('address_divergence_alert_threshold_meters', 'مسافة تنبيه اختلاف الموقع عن العنوان بالأمتار', 'فرق المسافة بين موقع GPS الفعلي والعنوان المسجل الذي يُظهر تنبيهاً أحمر', 'number', 50, 1000, '250'::jsonb, '{"global"}', '{"CUS-008"}', NULL),
  ('out_of_stock_customer_response_window_minutes', 'مهلة رد العميل عند نفاد صنف بالدقائق', 'المهلة المتاحة للعميل للرد باختيار البديل عند اتصال المتجر لنفاد صنف', 'duration_minutes', 1, 10, '3'::jsonb, '{"global"}', '{"ORD-005"}', NULL)
ON CONFLICT (key) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  description_ar = EXCLUDED.description_ar,
  type = EXCLUDED.type,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  default_value = EXCLUDED.default_value,
  allowed_levels = EXCLUDED.allowed_levels,
  related_requirements = EXCLUDED.related_requirements,
  options = EXCLUDED.options;

-- 2. تصنيفات المتاجر الافتراضية (MER-009)
INSERT INTO public.store_categories (name_ar, name_en, section_key, sort_order)
VALUES
  ('مطاعم ومأكولات', 'Restaurants', 'restaurants', 1),
  ('كافيهات ومشروبات', 'Cafes & Beverages', 'cafes', 2),
  ('شاورما وساندوتشات', 'Shawarma & Sandwiches', 'shawarma', 3),
  ('حلويات وآيسكريم', 'Sweets & Ice Cream', 'sweets', 4),
  ('مخابز ومعجنات', 'Bakeries & Pastries', 'bakeries', 5),
  ('مارت وتموينات', 'Mart & Groceries', 'mart', 6),
  ('صيدليات وعناية', 'Pharmacies & Care', 'pharmacy', 7),
  ('خضار وفواكه', 'Fruits & Vegetables', 'produce', 8)
ON CONFLICT DO NOTHING;

-- 3. أنواع المستندات الإلزامية للمنشأة والفروع (MER-001)
INSERT INTO public.document_types (code, name_ar, name_en, applies_to, is_mandatory, requires_expiry_date)
VALUES
  ('cr', 'السجل التجاري', 'Commercial Registration', 'merchant', true, true),
  ('vat_certificate', 'شهادة تسجيل ضريبة القيمة المضافة', 'VAT Certificate', 'merchant', true, false),
  ('baladiya_license', 'رخصة البلدية للفرع', 'Municipal License', 'branch', true, true)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  applies_to = EXCLUDED.applies_to,
  is_mandatory = EXCLUDED.is_mandatory,
  requires_expiry_date = EXCLUDED.requires_expiry_date;

-- 4. أسباب الإعفاء النظامي من لائحة السعرات (SFDA - REG-002)
INSERT INTO public.sfda_exemption_reasons (code, reason_ar, reason_en)
VALUES
  ('fresh_produce', 'خضار وفواكه طازجة غير معالجة', 'Fresh unprocessed fruits and vegetables'),
  ('custom_order', 'أغذية يتم إعدادها بناء على طلب العميل الخاص', 'Custom foods prepared upon specific customer request'),
  ('single_ingredient', 'أغذية ذات مكون واحد غير معبأة', 'Single ingredient bulk unpackaged foods'),
  ('temporary_special', 'أطباق خاصة مؤقتة لا تتجاوز 30 يوماً', 'Temporary menu specials under 30 days')
ON CONFLICT (code) DO UPDATE SET
  reason_ar = EXCLUDED.reason_ar,
  reason_en = EXCLUDED.reason_en;

