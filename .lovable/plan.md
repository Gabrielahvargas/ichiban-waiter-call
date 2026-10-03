# Reloj de Atlanta junto al estado "Conectado" en la pantalla de llamadas

## Qué se pide
En la pantalla de llamadas (`/screen`), junto a la insignia que dice "Connected / Conectado", mostrar la hora actual de Atlanta (zona horaria America/New_York, horario de verano incluido), actualizándose en vivo.

## Cambios

### 1. `src/routes/screen.tsx` — vista de display (DisplayView)
- En el encabezado, a la izquierda de la insignia de conexión, añadir un elemento de reloj con el mismo estilo discreto que el resto del encabezado (por ejemplo: "Atlanta · 8:55 PM").
- Formato de 12 horas con AM/PM (`Intl.DateTimeFormat` con `timeZone: "America/New_York"`), visible en pantalla grande y legible desde la TV.
- Usar el reloj que ya existe en la vista (`now`, derivado de `serverNow()`, que se actualiza cada 500 ms): así la hora mostrada no depende del reloj interno del TV/tablet y ya se refresca sola. No se añaden estados ni temporizadores nuevos.

### 2. Traducciones
- `src/i18n/en.ts` y `src/i18n/es.ts`: una clave nueva en la sección `screen` (por ejemplo `atlantaTime`: "Atlanta" / "Atlanta"). La hora se muestra como número, que no se traduce.

## Fuera de alcance
- No se cambia la lógica de llamadas, sonidos, emparejamiento ni luces.
- No se toca la pantalla de demo ni el panel administrativo (si también quieres el reloj en el panel de administración de llamadas, se agrega igual después).
- No se publica nada: queda en la vista previa hasta que digas lo contrario.

## Verificación
- Compilación sin errores.
- Probar con el navegador a 1280x720: reloj visible junto a "Connected", formato AM/PM correcto, sin desplazamiento del diseño 720p.
