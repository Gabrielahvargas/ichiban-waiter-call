ALTER TABLE public.app_settings ADD COLUMN shared_light_device_ids text[] NOT NULL DEFAULT '{}';
UPDATE public.app_settings SET shared_light_device_ids = ARRAY[shared_light_device_id] WHERE shared_light_device_id IS NOT NULL;
COMMENT ON COLUMN public.app_settings.shared_light_device_id IS 'DEPRECATED: replaced by shared_light_device_ids (kept in sync with the first ID)';