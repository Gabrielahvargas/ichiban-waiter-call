# Plan: segunda luz SERVER sincronizada con la existente

## Qué vas a notar
- Cuando haya una llamada activa, **las dos luces SERVER** se ponen en rojo con brillo máximo, al mismo tiempo.
- Cuando no quede ninguna llamada pendiente (atendida o terminada), las dos vuelven al estado normal (blanco, como hoy; nunca se apagan).
- En la página **Integración** verás la lista de todas las luces SERVER conectadas, cada una con su estado (en línea, admite color) y un botón "Buscar luces SERVER ahora".
- Las luces de las mesas, las automatizaciones HAPPY/SHOW/FIRE y cualquier otra luz no se tocan.

## Cómo se agrega la nueva luz
1. Primero busco en tu cuenta Tuya todas las luces llamadas exactamente **SERVER**. Hoy la app trata "dos luces con el mismo nombre" como un error; eso cambia: ahora guarda todas.
2. Si la nueva luz aparece, se guarda de forma permanente en la configuración junto con la actual (ID ebcd90c862cf034944oxdu).
3. Si no aparece (porque aún no está vinculada al proyecto Tuya ICHIBAN o tiene otro nombre), te digo exactamente qué falta: el ID del dispositivo o renombrarla a SERVER en Smart Life. No invento ningún ID.

## Verificación en la vista previa
- Creo una llamada de prueba desde el panel de botones, confirmo en el registro que **ambas** luces recibieron el mismo comando rojo; la atiendo y confirmo el comando blanco en las dos. Borro la llamada de prueba.
- Si una luz falla, la otra igual recibe su orden y el fallo queda registrado por luz.

Nada se publica sin tu permiso.

## Detalles técnicos
- Migración: nueva columna `app_settings.shared_light_device_ids text[] not null default '{}'`, rellenada con el valor de `shared_light_device_id`. La columna vieja se mantiene (marcada DEPRECATED) para no romper la app publicada.
- `tuya.server.ts`: sin cambios en `setSharedLight` (rojo = `work_mode colour` + `colour_data_v2 {h:0,s:1000,v:1000}`; blanco = `work_mode white` + brillo 1000).
- `shared-light.server.ts`: `syncSharedLight` envía el mismo estado a cada ID en paralelo (`Promise.allSettled`), registra cada resultado en `tuya_event_log`; `relinkSharedLightByName` guarda todos los matches (sin estado "ambiguous"); re-búsqueda si algún ID deja de responder.
- `shared-light.functions.ts`: `getSharedLightStatus` devuelve una lista de luces; `integration.tsx` y i18n EN/ES actualizados.
- Se reutiliza el mismo disparador actual (ingesta de eventos, panel remoto, resync manual); no se crea otro evento.
