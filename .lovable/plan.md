# Plan: luz SERVER automática + nuevas automatizaciones HAPPY

## Parte 1 — Nuevas automatizaciones HAPPY (botón 2, un toque)

Las automatizaciones SHOW se quedan como están (no se tocan), igual que SERVER y FIRE.

Se crean 9 automatizaciones nuevas en tu Smart Life, una por mesa: **100 HAPPY, 200 HAPPY … 900 HAPPY**.

Cada una:
1. Se activa con **un toque en el botón 2** de la botonera de esa mesa (el botón 2 no se usa para nada hoy).
2. Pone las luces de esa mesa (el mismo grupo de luces que usa su SHOW) en **modo escena**.
3. Espera **30 segundos**.
4. Las regresa a **modo blanco**.

La app de llamadas no cambia: el botón 2 sigue sin crear llamadas.

Prueba: creo primero solo **100 HAPPY**, la pruebas apretando el botón 2 de la mesa 100, y si te gusta creo las otras 8.

Nota: si al crearla Tuya no acepta el modo escena desde aquí, te aviso y te digo exactamente qué tocar en Smart Life.

## Parte 2 — Reconexión automática de la luz SERVER por nombre

Si la luz SERVER se borra y se vuelve a crear, la app la buscará sola por su nombre **SERVER** y se reconectará.

- Antes de cada cambio de color, si la luz guardada ya no responde, la app busca en Tuya una luz llamada SERVER.
- Si hay exactamente una, la guarda y repite la orden. Si no hay ninguna o hay dos con ese nombre, no adivina: lo muestra como aviso en la página Integración.
- En Integración se verá la luz conectada, la fecha de la última reconexión y un botón "Buscar SERVER ahora".
- Mantén el nombre exacto SERVER y no tengas dos luces con ese nombre.

## Detalles técnicos
- HAPPY: `POST /v1.0/homes/317212577/automations` por mesa, condición `switch_mode2 == click` sobre el ID de la botonera de esa mesa, acciones `deviceGroupDpIssue` al mismo grupo que su SHOW (`work_mode: scene` → `delay 30s` → `work_mode: white`), `match_type 1`, habilitada. Script puntual desde el servidor con las credenciales ya guardadas; no hay cambios de código en la app.
  - Grupos: 100→20839853, 200→20839879, 300→20839971, 400→20840018, 500→20840053, 600→20840076, 700→20840096, 800→20857477, 900→20864861.
- SERVER: columnas `app_settings.shared_light_device_name` (default 'SERVER') y `shared_light_relinked_at`; `findLightByName` en `tuya.server.ts` (categoría `dj`, nombre exacto); reintento único en `shared-light.server.ts` con registro en `tuya_event_log`; función admin `relinkSharedLight`; UI en `integration.tsx` + EN/ES. Llega a la app publicada solo al publicar.
