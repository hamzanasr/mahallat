-- تحديث دالة تعبئة القيم الافتراضية لعقد المتجر
CREATE OR REPLACE FUNCTION public.populate_contract_defaults_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_city_id UUID;
BEGIN
  SELECT city_id INTO v_city_id FROM public.stores WHERE id = NEW.store_id;

  -- قراءة القيم من دالة get_setting إذا لم يتم تمريرها
  IF NEW.tier1_fee_halalas IS NULL OR NEW.tier1_fee_halalas = 200 THEN
    NEW.tier1_fee_halalas := COALESCE((public.get_setting('tier1_fee_halalas', v_city_id, NULL, NEW.store_id)#>>'{}')::INT, 200);
  END IF;
  IF NEW.tier2_fee_halalas IS NULL OR NEW.tier2_fee_halalas = 500 THEN
    NEW.tier2_fee_halalas := COALESCE((public.get_setting('tier2_fee_halalas', v_city_id, NULL, NEW.store_id)#>>'{}')::INT, 500);
  END IF;
  IF NEW.contract_percentage IS NULL OR NEW.contract_percentage = 10.00 THEN
    NEW.contract_percentage := COALESCE((public.get_setting('store_contract_percentage', v_city_id, NULL, NEW.store_id)#>>'{}')::NUMERIC, 10.00);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
