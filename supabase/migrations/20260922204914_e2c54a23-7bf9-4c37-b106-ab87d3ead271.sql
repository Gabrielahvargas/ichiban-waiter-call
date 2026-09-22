ALTER TABLE public.dining_tables DROP CONSTRAINT IF EXISTS dining_tables_call_click_type_chk;
ALTER TABLE public.dining_tables DROP CONSTRAINT IF EXISTS dining_tables_attend_click_type_chk;

UPDATE public.dining_tables SET
  call_click_type = CASE lower(call_click_type)
    WHEN 'single' THEN 'single_click' WHEN 'click' THEN 'single_click'
    WHEN 'double' THEN 'double_click' WHEN 'long' THEN 'long_click'
    WHEN 'long_press' THEN 'long_click' ELSE lower(call_click_type) END,
  attend_click_type = CASE lower(attend_click_type)
    WHEN 'single' THEN 'single_click' WHEN 'click' THEN 'single_click'
    WHEN 'double' THEN 'double_click' WHEN 'long' THEN 'long_click'
    WHEN 'long_press' THEN 'long_click' ELSE lower(attend_click_type) END;

ALTER TABLE public.dining_tables ALTER COLUMN call_click_type SET DEFAULT 'single_click';
ALTER TABLE public.dining_tables ALTER COLUMN attend_click_type SET DEFAULT 'single_click';

ALTER TABLE public.dining_tables ADD CONSTRAINT dining_tables_call_click_type_chk
  CHECK (call_click_type IN ('single_click','double_click','long_click'));
ALTER TABLE public.dining_tables ADD CONSTRAINT dining_tables_attend_click_type_chk
  CHECK (attend_click_type IN ('single_click','double_click','long_click'));