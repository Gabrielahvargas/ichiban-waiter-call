
DELETE FROM public.waiter_assignments WHERE waiter_id IN (SELECT id FROM public.waiters WHERE full_name = 'Ana');
DELETE FROM public.waiters WHERE full_name = 'Ana';
DELETE FROM public.display_screens WHERE name IN ('Sala demo', 'Barra TV', 'TV cocina', 'TV prueba');
DELETE FROM public.button_events WHERE environment = 'demo';
DELETE FROM public.calls WHERE environment = 'demo';
DELETE FROM public.lighting_commands WHERE environment = 'demo';
