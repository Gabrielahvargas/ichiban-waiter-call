# Reloj en la pantalla de llamadas usando la zona horaria configurable

## Qué se pide
- En la pantalla de llamadas (`/screen`), junto a la insignia "Connected / Conectado", mostrar la hora actual, actualizándose en vivo.
- Sin zona horaria fija en el código: la hora se calcula con el ajuste "Restaurant time zone" que ya existe en Configuración; si ese ajuste falta o es inválido, se usa la zona horaria del dispositivo (TV/tablet).

## Cambios

### 1. `src/routes/screen.tsx` — vista de display (DisplayView)
- En el encabezado, a la izquierda de la insignia de conexión, añadir el reloj con estilo discreto y grande (por ejemplo: "New York · 8:55 PM", etiqueta derivada del nombre de la zona: "America/New_York" → "New York").
- Formato de 12 horas con AM/PM, legible desde la TV.
- Se reutiliza el reloj ya existente en la vista (`now`, derivado de `serverNow()`, se actualiza cada 500 ms): la hora no depende del reloj interno del TV y ya se refresca sola. Sin estados ni temporizadores nuevos.
- Lógica de zona: usar `state.settings.timezone`; si no existe o el navegador no reconoce ese valor, usar `Intl.DateTimeFormat().resolvedOptions().timeZone` (zona del dispositivo).

### 2. `src/routes/settings.tsx` — selector real de zona horaria
- Sustituir el campo de texto libre de "Restaurant time zone" por un selector (lista desplegable) con las zonas horarias estándar del sistema (`Intl.supportedValuesOf("timeZone")`, con lista reducida de respaldo si el navegador no lo soporta).
- Mostrar junto al selector una vista previa de la hora actual en la zona elegida, para que se vea al instante cuál conviene.
- El valor elegido se guarda con el mismo mecanismo de Guardar/Descartar que ya existe; no se toca la base de datos (la columna `app_settings.timezone` ya existe).

### 3. Zona horaria por defecto: Atlanta
- `src/modules/config/useSettings.ts`: el valor de respaldo pasa de `America/Chicago` a `America/New_York` (Atlanta), aplicándose solo cuando nunca se haya guardado la configuración.
- En la base de datos: actualizar el valor ya guardado en la configuración global (`app_settings.timezone`) a `America/New_York` con una migración, para que el reloj de la pantalla muestre Atlanta de inmediato sin que tengas que tocar nada. Si alguien cambia la zona después en Configuración, esa elección se respeta.

### 4. Traducciones
- `src/i18n/en.ts` y `src/i18n/es.ts`: claves nuevas para la vista previa de hora del selector (por ejemplo "Current time in this zone" / "Hora actual en esta zona") y para el reloj si hace falta. La hora en sí no se traduce.

## Fuera de alcance
- No se cambia la lógica de llamadas, sonidos, emparejamiento ni luces.
- No se publica nada: queda en la vista previa hasta que digas lo contrario.

## Verificación
- Compilación sin errores.
- Con el navegador a 1280x720: reloj visible junto a "Connected", formato AM/PM correcto, sin desplazamiento del diseño 720p.
- Cambiar la zona en Configuración y confirmar que el reloj de la pantalla muestra la hora correcta; probar también con una zona inválida (debe usar la del dispositivo).
