# Botonera móvil para administradores (llamar / atender desde el celular)

## Qué se construye

Una nueva página **"Botonera"** en el menú lateral, pensada para el celular, con la misma idea de la página de Demostración pero actuando sobre las llamadas **reales** (producción), no sobre el demo.

### Diseño elegido: "Cuadrícula alto contraste" (prototipo v2)

- Encabezado con título **Botonera** y una pastilla roja con el conteo de llamadas pendientes (ej. "3 pendientes"), que pulsa cuando hay llamadas.
- Una tarjeta por mesa (100–1000), en lista de una columna:
  - Izquierda: etiqueta "Mesa" y número grande en negrita.
  - Derecha: dos botones grandes (mín. 56 px de alto) en dos columnas: **Llamar** (rojo) y **Atendida** (verde).
- Mesa con llamada pendiente: tarjeta con borde rojo y brillo suave; el botón Llamar muestra el tiempo transcurrido ("Hace 2m" / "2m ago"); el botón Atendida se enfatiza para cerrarla.
- Mesa sin llamada: estilo neutro, botones disponibles.
- Se actualiza en tiempo real cuando llegan o se atienden llamadas.

### Comportamiento

- Cada pulsación usa la misma función del servidor que los botones físicos (`ingest_button_event`, environment producción, source "remote_panel"): se conservan una sola llamada activa por mesa, cooldown, historial, métricas y asignación de mesero.
- Respeta la configuración de botón/tipo de pulsación de cada mesa.
- Tras cada llamada o atención se sincroniza la **bombilla del área de meseros (Server)**: roja mientras haya pendientes, blanca cuando no quede ninguna.
- La llamada aparece en la TV/tablet en tiempo real, igual que con el botón físico.
- Acceso **solo administradores**. Textos en inglés y español.

## Limitación conocida

- La bombilla de cada mesa (ej. 701) que se pone roja 3 segundos con el botón físico lo hace una automatización de Smart Life; desde la botonera web no se puede disparar. La botonera sí controla la luz compartida del área de meseros.

## Cambios técnicos

- Nueva ruta `src/routes/remote.tsx`: reutiliza `ingestButtonEvent` con `environment: "production"`, `source: "remote_panel"`; lee `dining_tables`; suscripción realtime a `calls` (producción) para estado pendiente y tiempos; llama `resyncSharedLight` tras cada acción.
- Entrada nueva en el menú lateral (`src/components/AppShell.tsx`) con icono.
- Claves i18n nuevas en `src/i18n/en.ts` y `src/i18n/es.ts`.
- Sin cambios en base de datos, backend, Tuya, puente de Railway ni reglas de llamadas.

## Verificación

- TypeScript/build sin errores.
- Prueba con Playwright en tamaño de celular: llamar una mesa, verla en la pantalla de llamadas, atenderla y confirmar que desaparece y la luz compartida vuelve a blanco.
- No se publica; queda en vista previa hasta que pidas publicar.
