-- ==============================================================================
-- إزالة التكرار في أنواع المستندات وضبط إلزامية مستندات الفرع (MER-001)
-- ==============================================================================

-- 1. دمج أو حذف المستند المكرر 'baladiya' لصالح 'baladiya_license'
UPDATE public.uploaded_documents
SET document_type_id = (SELECT id FROM public.document_types WHERE code = 'baladiya_license' LIMIT 1)
WHERE document_type_id IN (SELECT id FROM public.document_types WHERE code = 'baladiya');

DELETE FROM public.document_types WHERE code = 'baladiya';

-- 2. جعل الشهادات الصحية اختيارية وليست مانعة للتفعيل التلقائي إلا إذا حُدد ذلك
UPDATE public.document_types
SET is_mandatory = false
WHERE code IN ('health', 'civil_defense');

-- التأكد من وجود رخصة البلدية فقط كمستند إلزامي أساسي للفرع
UPDATE public.document_types
SET is_mandatory = true
WHERE code = 'baladiya_license';
