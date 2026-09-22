ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS shared_light_device_id text;

UPDATE public.app_settings
   SET shared_light_device_id = 'eb00282f7b2a7df65ccrwj'
 WHERE id = 'global' AND (shared_light_device_id IS NULL OR shared_light_device_id = '');