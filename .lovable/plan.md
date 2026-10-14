# Luz de mesa roja fija hasta que atiendan la llamada

## Qué pasa hoy

- Al presionar el botón de llamar, la luz de la mesa la enciende una automatización de Smart Life ("HAPPY") que la pone en escena y **la regresa a blanco sola a los 30 segundos**. Por eso los meseros pierden la señal.
- La app solo controla las luces SERVER del área de meseros (rojo con llamadas pendientes, blanco cuando no quedan). Las luces de cada mesa no las toca.
- En la base de datos cada mesa ya tiene registradas sus luces (`bulbs`), pero sin el identificador de Tuya (`external_id` vacío).

## Objetivo

- Botón de llamar → la luz de esa mesa se pone **roja con brillo máximo y se queda así** hasta que atiendan.
- Botón verde (atendida) → la luz de esa mesa **regresa a blanco normal**.
- Las luces SERVER siguen funcionando igual que hoy. No se toca nada más.

## Cambios

1. **Guardar el identificador de cada luz de mesa (persistente, no hardcodeado)**
   - Las luces de mesa en Tuya son **grupos** (ya conocidos de las automatizaciones HAPPY: 200→20839879, 300→20839971, 400→20840018, 500→20840053, 600→20840076, 700→20840096, 800→20857477, 900→20864861).
   - Se guardan en `bulbs.external_id` de cada mesa. Falta confirmar el grupo de las mesas **100 y 1000**: se buscan en la cuenta de Tuya por nombre; si no aparecen, se deja claro cuál falta y no se inventa.
   - Se agrega el campo editable en Configuración para poder corregirlo sin tocar código.

2. **Control de luz de mesa desde la app (backend)**
   - Nueva función `syncTableLight(table_number, "red" | "white")` en el servidor, reutilizando la misma lógica de comandos que ya usa la luz SERVER (rojo = color rojo brillo máximo, blanco = luz normal). Los grupos de Tuya usan el endpoint `/v1.0/device-groups/{id}/commands`.
   - Se llama en los mismos puntos donde hoy se sincroniza la luz SERVER:
     - Al llegar un evento de botón (llamar → rojo; atendida → blanco).
     - Desde el panel remoto `/remote` (llamar/atendida).
   - Cada envío queda registrado en el registro de eventos Tuya, igual que las SERVER.

3. **Apagar la automatización HAPPY que regresa la luz a blanco a los 30 s**
   - Si HAPPY sigue activa, apagaría el rojo a los 30 segundos aunque la app lo mantenga. Una vez verificado que la app enciende el rojo fijo, se **desactivan las automatizaciones HAPPY** (100–900) vía API de Tuya. No se borran: quedan apagadas por si se quieren reactivar.

4. **Verificación en vista previa**
   - Llamada de prueba en una mesa → luz roja y se mantiene (esperar más de 30 s para confirmar que ya no regresa sola).
   - Atender → luz blanca.
   - Revisar el registro de eventos para confirmar que el comando llegó a la luz correcta.
   - Confirmar que las dos luces SERVER siguen igual.

## Notas técnicas

- Archivos: `src/lib/tuya.server.ts` (comandos a grupos), nuevo `src/lib/table-light.server.ts`, `src/routes/api/public/tuya-events.ts`, `src/routes/remote.tsx`, `src/routes/settings.tsx`, traducciones EN/ES.
- Sin cambios de base de datos destructivos: solo se llenan `external_id` existentes.
- No se publica; todo queda en vista previa hasta que lo pidas.
