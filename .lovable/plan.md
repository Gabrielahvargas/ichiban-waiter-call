# Configuración: guardar visible y sonidos de alerta

## Qué pasa hoy
- Sí existe un botón "Guardar", pero solo arriba del todo, junto al título. Al bajar por la página desaparece de la vista y no hay aviso de cambios sin guardar.
- El sonido es un único "ding" generado por la app; no se puede elegir ni escuchar desde Configuración.
- En las pantallas emparejadas (TV/tablet) la opción "solo al superar el tiempo de espera" no suena; solo funciona "cada llamada".

## Cambios

### 1. Guardar siempre visible
- Barra fija en la parte inferior de Configuración con el botón **Guardar** y **Descartar**.
- Indicador "Cambios sin guardar" cuando modificas algo; tras guardar, mensaje "Guardado" y el indicador desaparece.
- Aviso si intentas salir de la página con cambios pendientes.
- Las tarjetas de cada mesa (botones y focos) mantienen su botón Guardar propio, con el mismo aviso de cambios pendientes.

### 2. Elegir y escuchar el sonido
En la sección de alertas de llamadas:
- Lista de 4–5 sonidos incluidos (campanita, doble timbre, alarma suave, alarma fuerte, cocina).
- Botón **Escuchar** junto a cada opción.
- Control de volumen.
- Opción **Subir mi sonido (MP3)**: se guarda en la nube (máx. 1 MB), se puede escuchar y reemplazar o eliminar.
- Se explica en texto qué hace el tiempo en segundos: "suena cuando una mesa lleva esperando más de X segundos".

### 3. Sonido en todas las pantallas
- La TV/tablet y la pantalla del admin usan el sonido y volumen elegidos.
- Se completa el modo "solo al superar el tiempo" en las pantallas emparejadas.
- Nota: los navegadores bloquean el sonido hasta que alguien toca la pantalla una vez; se mostrará un aviso "Toca para activar sonido" si está bloqueado.

Todo en inglés y español. No se cambian mesas 700/800, botones, bombilla ni Tuya.

## Detalles técnicos
- Migración: `app_settings.sound_id text default 'chime'`, `sound_volume int default 80`, `custom_sound_path text null`.
- Bucket de almacenamiento `alert-sounds` (lectura pública, escritura solo admin), validar `audio/mpeg`, ≤1 MB.
- `screen_state` devuelve sound_id, volumen y URL del sonido personalizado.
- Módulo compartido `src/modules/sound/` con sonidos sintetizados (WebAudio) + reproducción de MP3; reutilizado en `CallsScreen.tsx` y `screen.tsx` (eliminar el `playChime` duplicado).
- `settings.tsx`: estado "dirty" comparando draft vs settings, barra sticky, `beforeunload`.
