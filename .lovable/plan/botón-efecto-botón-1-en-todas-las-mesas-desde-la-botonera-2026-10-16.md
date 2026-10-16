# Botón "efecto botón 1" en todas las mesas desde la Botonera

## Qué se construye

Un botón grande en la parte superior de la página **Botonera** (`/remote`) que, al presionarlo, activa en **todas las mesas** el mismo efecto de luces que hoy produce el botón 1 con doble clic (la automatización SHOW de Smart Life).

## Punto clave

El efecto del botón 1 lo ejecuta hoy una automatización de Smart Life sobre las luces de cada mesa; la app no pulsa botones físicos. Para lograr lo mismo desde la Botonera, la app enviará directamente a Tuya la misma orden de escena a los grupos de luces de todas las mesas (100–1000), reutilizando la conexión con Tuya que ya usa la luz SERVER.

## Cambios

1. **Nueva función de servidor (solo administradores)** `triggerShowAllTables`:
   - Lee los grupos de luces de las mesas ya conocidos (los mismos que usan las automatizaciones SHOW/HAPPY).
   - Envía a cada grupo la orden de escena (el mismo efecto del botón 1) en paralelo, con registro por mesa en `tuya_event_log` para ver cuáles respondieron.
   - Devuelve un resumen: cuántas mesas recibieron la orden y cuáles fallaron.
2. **Botón en la Botonera** (`src/routes/remote.tsx`):
   - Botón destacado arriba de la lista de mesas, con texto "SHOW en todas las mesas" / "SHOW on all tables".
   - Pide confirmación antes de ejecutar (para no activarlo por accidente).
   - Muestra un aviso con el resultado (ej. "Enviado a 9 mesas" o "Falló en mesa 700").
3. **Textos** nuevos en inglés y español (`src/i18n/en.ts`, `src/i18n/es.ts`).

## Lo que NO cambia

- No se tocan las automatizaciones de Smart Life (SHOW/HAPPY), ni los botones físicos, ni la lógica de llamadas, ni las luces SERVER.
- El botón 1 físico sigue funcionando igual; esto solo agrega una forma de disparar el efecto desde el celular.

## Verificación

- TypeScript/build sin errores.
- Prueba en vista previa con sesión de administrador: presionar el botón y confirmar en el registro que la orden llegó a todas las mesas; confirmar contigo que las luces hacen el efecto.
- No se publica; queda en vista previa hasta que pidas publicar.
