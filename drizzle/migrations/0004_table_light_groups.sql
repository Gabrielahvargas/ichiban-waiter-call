ALTER TABLE public.dining_tables ADD COLUMN IF NOT EXISTS light_group_id text;

UPDATE public.dining_tables SET light_group_id = '20839879' WHERE table_number = 200;
UPDATE public.dining_tables SET light_group_id = '20839971' WHERE table_number = 300;
UPDATE public.dining_tables SET light_group_id = '20840018' WHERE table_number = 400;
UPDATE public.dining_tables SET light_group_id = '20840053' WHERE table_number = 500;
UPDATE public.dining_tables SET light_group_id = '20840076' WHERE table_number = 600;
UPDATE public.dining_tables SET light_group_id = '20840096' WHERE table_number = 700;
UPDATE public.dining_tables SET light_group_id = '20857477' WHERE table_number = 800;
UPDATE public.dining_tables SET light_group_id = '20864861' WHERE table_number = 900;