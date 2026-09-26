# Botonera móvil para administradores (llamar / atender desde el celular)

## Qué se construye

Una nueva página **"Botonera"** en el menú lateral, pensada para usarse desde el celular, con la misma idea de la página de Demostración pero actuando sobre las llamadas **reales** (producción), no sobre el demo:

- Una fila por mesa (100–1000) con dos botones grandes y táctiles:
  - **Llamar** — equivale al botón 3 físico de esa mesa.
  - **Atendida** — equivale al botón 4 físico de esa mesa.
- Los botones respetan la configuración de cada mesa (botón y tipo de pulsación configurados en Configuración), igual que el demo.
- Cada pulsación pasa por la misma función del servidor que usan los botones físicos (`ingest_button_event`), así que se conservan: una sola llamada activa por mesa, cooldown, registro de eventos, historial, métricas y asignación de mesero.
- Después de cada llamada o atención, se sincroniza la **bombilla del área de meseros (Server)** con la lógica ya existente: roja mientras haya llamadas pendientes, blanca cuando no quede ninguna.
- La llamada aparece en la TV/tablet en tiempo real, igual que si se hubiera presionado el botón físico.
- Acceso **solo administradores** (misma protección que Meseros/Configuración).
- Textos en inglés y español.

## Diseño móvil

- Botones grandes (mínimo 48 px de alto), una mesa por fila, pensado para pulgar.
- Estado visible por mesa: si tiene llamada pendiente se resalta, para saber cuál atender.
- Avisos de confirmación ("Mesa 700 llamando", "Mesa 700 atendida", "ya tiene llamada pendiente", etc.) reutilizando los mensajes existentes.

## Limitación conocida (se indica honestamente)

- La bombilla de la mesa (ej. 701) que se pone roja 3 segundos con el botón físico lo hace una automatización de Smart Life; desde la botonera web no se puede disparar esa automatización. La botonera sí controla la luz compartida del área de meseros.

## Cambios técnicos

- Nueva ruta `src/routes/remote.tsx` (nombre visible "Botonera" / "Remote panel"): reutiliza `ingestButtonEvent` con `environment: "production"`, `source: "remote_panel"`, lee la configuración de `dining_tables`, muestra llamadas pendientes en tiempo real (suscripción a `calls`) y llama `resyncSharedLight` tras cada acción.
- Entrada nueva en el menú lateral (`src/components/AppShell.tsx`) con icono.
- Claves i18n nuevas en `src/i18n/en.ts` y `src/i18n/es.ts`.
- Sin cambios en base de datos, backend, Tuya, puente de Railway ni reglas de llamadas.

## Verificación

- TypeScript/build sin errores.
- Prueba con Playwright en tamaño de celular: llamar una mesa desde la botonera, verla aparecer en la pantalla de llamadas, atenderla y confirmar que desaparece y que la luz compartida vuelve a blanco.
- No se publica; queda en vista previa hasta que pidas publicar.
