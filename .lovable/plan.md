# Detener el SHOW en todas las mesas y apagado automático

## Qué vas a ver en la Botonera
- Junto al botón "SHOW en todas las mesas" aparece un botón **"Detener en todas"**: regresa al mismo tiempo todas las luces de las mesas a su luz normal (blanca).
- Un selector **"Detener solo después de"**: Sin límite / 10 s / 30 s / 60 s / 2 min. Si eliges un tiempo, al lanzar el SHOW las luces vuelven solas a blanco al terminar ese tiempo, aunque cierres el celular.
- Mientras corre, se muestra una cuenta regresiva ("Se detiene en 25 s") y el botón Detener sigue funcionando para cortarlo antes.
- El tiempo elegido queda guardado para la próxima vez.

## Qué no cambia
Automatizaciones de Smart Life (SHOW/HAPPY), botones físicos, llamadas y luces SERVER. Mesas 100 y 1000 siguen fuera hasta tener su grupo de luces.

## Detalles técnicos
- `tuya.server.ts`: `setGroupWhite(groupId)` (mismo comando que usa HAPPY para volver a blanco).
- `show-all.functions.ts`: `stopShowAllTables` (admin, paralelo, log `show_stop_sent` por mesa). `triggerShowAllTables` acepta `autoStopSeconds` (0–600).
- Apagado automático en el servidor: tabla `show_runs` (id, started_at, stop_at, stopped_at); el SHOW crea la fila. Un trabajo programado de un minuto no sirve para 10 s, así que se usa la espera dentro de la base: al crear la fila se agenda una tarea pg_cron de un solo uso que espera hasta `stop_at` y llama a `/api/public/show-stop` (autenticado con el token ya existente del cron de ventas), que manda blanco y marca `stopped_at`; si ya se detuvo manualmente no hace nada. Si un SHOW nuevo empieza, el anterior se cancela.
- Remote: selector guardado en `localStorage`, cuenta regresiva con `stop_at` devuelto por el servidor, i18n EN/ES.
- Verificación: build, prueba con sesión admin: SHOW con 10 s → registro muestra escena y luego blanco; Detener manual → blanco inmediato. Sin publicar.
