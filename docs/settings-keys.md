# جدول مطابقة مفاتيح الإعدادات المرنة (ADM-034)

يوثق هذا الملف ربط كل بند في [docs/spec/32-settings.md](file:///c:/Users/Hamza/Downloads/mahallat/docs/spec/32-settings.md) بالمفتاح البرمجي المعتمد وقيمته الافتراضية ونوعه في قاعدة البيانات.

| المفتاح البرمجي | البند الأصلي في المواصفات | النوع | القيمة الافتراضية | المستويات المسموحة | المتطلب المرتبط |
|---|---|---|---|---|---|
| `order_cancellation_grace_period_seconds` | مهلة التراجع بعد الدفع | `duration_seconds` | `60` | عام | ORD-001 |
| `merchant_prep_time_edit_window_minutes` | تعديل مدة التحضير (المهلة) | `duration_minutes` | `3` | عام | MER-009 |
| `merchant_prep_time_max_edits` | تعديل مدة التحضير (عدد المرات) | `number` | `1` | عام | MER-009 |
| `product_max_prep_time_minutes` | مدة تحضير المنتج (الحد الأقصى) | `duration_minutes` | `40` | عام، متجر | MER-009 |
| `store_max_prep_time_minutes` | الحد الأعلى لمدة التحضير للمتجر | `duration_minutes` | `40` | عام، متجر | MER-009 |
| `busy_mode_max_added_minutes` | وضع الانشغال (الزيادة بالدقائق) | `duration_minutes` | `15` | عام | MER-046 |
| `busy_mode_max_duration_minutes` | وضع الانشغال (المدة القصوى للتفعيل) | `duration_minutes` | `60` | عام | MER-046 |
| `driver_pickup_early_alert_minutes` | تنبيه المندوب للاستلام مبكراً | `duration_minutes` | `5` | عام | DRV-003 |
| `merchant_delay_grace_minutes` | غرامة تأخر التاجر (بدء الاحتساب) | `duration_minutes` | `10` | عام | MER-040 |
| `merchant_delay_fine_percentage` | غرامة تأخر التاجر (النسبة) | `percentage` | `10.0` | عام | MER-040 |
| `merchant_delay_fine_max_halalas` | غرامة تأخر التاجر (الحد الأقصى بالهللة) | `amount_halalas` | `500` (5 ر.س) | عام | MER-040 |
| `driver_delay_penalty_percentage_per_minute` | خصم تأخر المندوب (لكل دقيقة) | `percentage` | `1.0` | عام | DRV-008 |
| `driver_delay_penalty_max_halalas` | خصم تأخر المندوب (الحد الأقصى بالهللة) | `amount_halalas` | `2000` (20 ر.س) | عام | DRV-008 |
| `delivery_time_buffer_minutes` | مدة التوصيل المسموحة (زيادة على جوجل) | `duration_minutes` | `5` | عام | DSP-001 |
| `customer_display_prep_buffer_minutes` | الإضافة على وقت التحضير المعروض للعميل | `duration_minutes` | `5` | عام | CUS-005 |
| `customer_display_delivery_buffer_minutes` | الإضافة على وقت التوصيل المعروض للعميل | `duration_minutes` | `5` | عام | CUS-005 |
| `geofence_arrival_radius_meters` | نطاق الاستلام والتسليم الجغرافي | `number` | `100` | عام | DSP-002 |
| `driver_wait_before_alert_minutes` | انتظار المندوب قبل تنبيه العميل | `duration_minutes` | `5` | عام | DRV-005 |
| `unresponsive_auto_complete_minutes` | الإنهاء التلقائي لعدم التجاوب بعد الوصول | `duration_minutes` | `30` | عام | ORD-008 |
| `meet_driver_alert_distance_meters` | مسافة إشعار «التقِ بالمندوب» | `number` | `1000` (1 كم) | عام | CUS-007 |
| `driver_max_batch_orders` | عدد الطلبات المجمعة مع المندوب | `number` | `3` | عام | DSP-003 |
| `driver_batch_order_cluster_meters` | أقصى مسافة تجميع بين العملاء | `number` | `1000` (1 كم) | عام | DSP-003 |
| `unassigned_order_ops_alert_minutes` | طلب بلا مندوب: تنبيه العمليات | `duration_minutes` | `5` | عام | DSP-001 |
| `unassigned_order_auto_cancel_minutes` | طلب بلا مندوب: إلغاء تلقائي | `duration_minutes` | `15` | عام | DSP-001 |
| `driver_cancel_before_prep_fine_halalas` | غرامة إلغاء المندوب قبل التجهيز | `amount_halalas` | `500` (5 ر.س) | عام | DRV-010 |
| `driver_security_deposit_halalas` | مبلغ تأمين المندوب | `amount_halalas` | `10000` (100 ر.س) | عام | DRV-001 |
| `customer_complaint_window_hours` | مهلة شكوى العميل بعد التسليم | `duration_minutes` | `60` (ساعة) | عام | SUP-001 |
| `merchant_dispute_window_days` | مهلة اعتراض التاجر بعد التحويل | `number` | `7` | عام | MER-015 |
| `reward_claim_expiry_hours` | مهلة استلام المكافأة قبل السقوط | `number` | `24` | عام | MKT-003 |
| `promotional_credit_validity_days` | صلاحية رصيد التعويض والترويجي | `number` | `14` | عام | PAY-008 |
| `referral_reward_credit_halalas` | مكافأة دعوة صديق بالهللة | `amount_halalas` | `1000` (10 ر.س) | عام، مدينة | MKT-001 |
| `loyalty_platform_net_percentage` | نسبة برنامج الولاء من صافي المنصة | `percentage` | `10.0` | عام، مدينة | MKT-004 |
| `loyalty_points_per_riyal` | عدد نقاط الولاء لكل ريال | `number` | `100` | عام، مدينة | MKT-004 |
| `loyalty_min_redemption_points` | الحد الأدنى لاستبدال نقاط الولاء | `number` | `500` | عام، مدينة | MKT-004 |
| `loyalty_points_expiry_days` | صلاحية نقاط الولاء بالأيام | `number` | `90` | عام، مدينة | MKT-004 |
| `allow_coupon_with_wallet_credit` | جمع الكوبون مع رصيد المحفظة | `boolean` | `true` | عام | MKT-002 |
| `customer_service_fee_type` | نوع رسم الخدمة على العميل | `select` | `"percentage"` | عام، مدينة | PAY-002 |
| `customer_service_fee_percentage` | نسبة رسم الخدمة على العميل | `percentage` | `2.5` | عام، مدينة | PAY-002 |
| `customer_service_fee_fixed_halalas` | رسم الخدمة الثابت على العميل | `amount_halalas` | `0` | عام، مدينة | PAY-002 |
| `store_contract_type` | نوع عقد المتجر الافتراضي | `select` | `"per_customer"` | عام، متجر | MER-001 |
| `tier1_order_threshold_halalas` | حد الطلب الصغير لشريحة العميل الأولى | `amount_halalas` | `2500` (25 ر.س) | عام، متجر | MER-001 |
| `tier1_fee_halalas` | رسم الشريحة الأولى (طلب أقل من 25) | `amount_halalas` | `200` (2 ر.س) | عام، متجر | MER-001 |
| `tier2_fee_halalas` | رسم الشريحة الثانية (طلب 25 فأكثر) | `amount_halalas` | `500` (5 ر.س) | عام، متجر | MER-001 |
| `contract_per_customer_cap_halalas` | سقف الرسوم لكل عميل عند المتجر | `amount_halalas` | `3000` (30 ر.س) | عام، متجر | MER-001 |
| `contract_per_customer_period_days` | مدة احتساب عميل المتجر | `number` | `365` | عام، متجر | MER-001 |
| `store_contract_percentage` | نسبة العقد الافتراضية (النوع الثاني) | `percentage` | `10.0` | عام، متجر | MER-001 |
| `menu_price_markup_percentage` | الزيادة على سعر المنيو | `percentage` | `0.0` | عام، متجر | MER-025 |
| `menu_markup_platform_share_percentage` | حصة المنصة من زيادة المنيو | `percentage` | `100.0` | عام، متجر | MER-025 |
| `payment_gateway_fee_percentage` | نسبة رسم بوابة الدفع | `percentage` | `2.5` | عام | PAY-001 |
| `payment_gateway_fee_fixed_halalas` | رسم بوابة الدفع الثابت بالهللة | `amount_halalas` | `100` (1 ر.س) | عام | PAY-001 |
| `mart_pharmacy_merchant_percentage` | نسبة المارت والصيدليات على التاجر | `percentage` | `5.0` | عام، متجر | MER-001 |
| `mart_pharmacy_customer_markup_percentage` | زيادة المارت والصيدليات على العميل | `percentage` | `5.0` | عام، متجر | MER-001 |
| `text_orders_platform_fee_percentage` | نسبة المنصة في طلبات الكتابة | `percentage` | `5.0` | عام، متجر | ORD-010 |
| `self_pickup_discount_percentage` | خصم الاستلام الذاتي | `percentage` | `0.0` | عام، متجر | ORD-003 |
| `self_pickup_ops_alert_minutes` | تنبيه استلام ذاتي غير مستلم | `duration_minutes` | `60` | عام | ORD-003 |
| `delivery_base_fee_halalas` | رسم التوصيل الأساسي | `amount_halalas` | `1200` (12 ر.س) | عام، مدينة، متجر | DSP-002 |
| `delivery_base_distance_km` | مسافة التوصيل الأساسية بالكيلو | `number` | `5` | عام، مدينة، متجر | DSP-002 |
| `delivery_per_km_fee_halalas` | رسم التوصيل لكل كيلومتر إضافي | `amount_halalas` | `150` (1.5 ر.س) | عام، مدينة، متجر | DSP-002 |
| `platform_driver_commission_percentage` | نسبة المنصة من توصيل المناديب | `percentage` | `10.0` | عام، مدينة | DRV-001 |
| `vat_percentage` | نسبة ضريبة القيمة المضافة | `percentage` | `15.0` | عام | ADM-034 |
| `uncontracted_service_fee_halalas` | رسوم خدمة غير المتعاقد و«اطلب اللي تبي» | `amount_halalas` | `500` (5 ر.س) | عام | ORD-011 |
| `flash_deal_min_discount_percentage` | الحد الأدنى لخصم عرض الساعة | `percentage` | `50.0` | عام | MKT-005 |
| `taxi_driver_max_cancels_before_ban` | حظر سائق Taxi بعد عدد إلغاءات | `number` | `3` | عام | TAX-001 |
| `address_divergence_alert_threshold_meters` | مسافة تنبيه اختلاف موقع العميل عن العنوان | `number` | `250` | عام | CUS-008 |
| `out_of_stock_customer_response_window_minutes` | مهلة رد العميل عند نفاد صنف | `duration_minutes` | `3` | عام | ORD-005 |
| `section_restaurants_enabled` | إظهار قسم المطاعم | `boolean` | `true` | عام، مدينة | CUS-009 |
| `section_retail_enabled` | إظهار قسم المحلات المتنوعة | `boolean` | `true` | عام، مدينة | CUS-009 |
| `section_mart_enabled` | إظهار قسم المارت والسوبرماركت | `boolean` | `true` | عام، مدينة | CUS-009 |
| `section_pharmacy_enabled` | إظهار قسم الصيدليات (مخفي افتراضياً) | `boolean` | `false` | عام، مدينة | CUS-009 |
| `section_self_pickup_enabled` | إظهار خدمة استلم بنفسك | `boolean` | `true` | عام، مدينة | CUS-009 |
| `section_taxi_enabled` | إظهار خدمة Taxi (قريباً) | `boolean` | `true` | عام، مدينة | CUS-009 |
| `otp_max_requests_per_phone` | الحد الأقصى لرسائل OTP لكل رقم | `number` | `5` | عام | ADM-001 |
| `otp_max_requests_per_device` | الحد الأقصى لرسائل OTP لكل جهاز | `number` | `10` | عام | ADM-001 |
| `otp_rate_limit_window_minutes` | مدة نافذة حد رسائل OTP بالدقائق | `duration_minutes` | `15` | عام | ADM-001 |
| `terms_version` | رقم النسخة الحالية للشروط وسياسة الخصوصية | `select` | `"1.0"` | عام | REG-004 |
| `delivery_base_fee_restaurants_halalas` | رسم التوصيل الأساسي للمطاعم والمحلات | `amount_halalas` | `1500` (15 ر.س) | عام، مدينة، متجر | PAY-013 |
| `delivery_base_fee_mart_halalas` | رسم التوصيل الأساسي للمارت والصيدليات | `amount_halalas` | `1200` (12 ر.س) | عام، مدينة، متجر | PAY-013 |
| `delivery_base_included_km` | الكيلومترات المشمولة في الرسم الأساسي | `number` | `3` | عام، مدينة، متجر | PAY-013 |
| `delivery_per_extra_km_fee_halalas` | سعر كل كيلومتر إضافي | `amount_halalas` | `100` (1 ر.س) | عام، مدينة، متجر | PAY-013 |
| `delivery_min_fee_halalas` | الحد الأدنى لرسوم التوصيل | `amount_halalas` | `500` (5 ر.س) | عام، مدينة | PAY-013 |
| `delivery_max_fee_halalas` | الحد الأقصى لرسوم التوصيل | `amount_halalas` | `3000` (30 ر.س) | عام، مدينة | PAY-013 |
| `customer_service_fee_enabled` | تفعيل رسوم الخدمة في المدينة | `boolean` | `true` | عام، مدينة | PAY-021 |
| `estimated_delivery_speed_kmh` | متوسط سرعة التوصيل للتقدير قبل الطلب | `number` | `25` | عام، مدينة | ORD-011 |
| `estimated_time_range_window_minutes` | عرض نطاق الوقت التقديري | `duration_minutes` | `10` | عام | ORD-011 |
