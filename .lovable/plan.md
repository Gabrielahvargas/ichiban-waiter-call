# Reconexión automática de la luz SERVER por nombre

## Qué va a pasar
Cuando la app mande la luz a rojo o blanco y la luz guardada ya no responda (porque se borró y se volvió a crear), la app buscará sola en tu cuenta de Tuya una luz llamada **SERVER**, la guardará como la nueva luz y repetirá la orden. No tendrás que avisarme.

## Cómo funciona
1. La app recuerda el nombre de la luz: **SERVER** (se podrá cambiar en Administración > Integración).
2. Antes de cada cambio de color, si la luz guardada da error o ya no existe:
   - busca en Tuya una luz con ese nombre (sin importar mayúsculas),
   - si hay exactamente una, la guarda y reenvía la orden,
   - si no hay ninguna o hay varias con el mismo nombre, no adivina: lo anota en el registro y muestra un aviso en la página de Integración.
3. En Integración se verá: nombre buscado, luz conectada y la fecha de la última reconexión automática, además de un botón "Buscar SERVER ahora".

## Importante
- Mantén el nombre exacto **SERVER** en Smart Life y no tengas dos luces con ese nombre.
- Los botones de mesa (700, 800…) no cambian con esto; si alguna vez recreas un botón, seguirá haciendo falta volver a asignarlo.

## Detalles técnicos
- Nueva columna `app_settings.shared_light_device_name` (default 'SERVER') y `shared_light_relinked_at`.
- `tuya.server.ts`: `findLightByName(name)` usando `/v2.0/cloud/thing/device` paginado, filtrando `category = 'dj'` y nombre igual.
- `shared-light.server.ts`: si `getDevice`/`setSharedLight` falla (permission deny, not found), llamar a `findLightByName`, actualizar el ID con cliente admin, reintentar una vez y registrar `shared_light_relinked` o `shared_light_relink_failed` en `tuya_event_log`.
- `shared-light.functions.ts`: nueva función admin `relinkSharedLight`; el estado devuelve nombre y fecha de reconexión.
- `integration.tsx` + i18n EN/ES: campo de nombre, fecha y botón.
- Funciona en la app publicada solo después de publicar.
