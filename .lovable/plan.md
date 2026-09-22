# Conexión con Tuya Cloud — plan

Objetivo: recibir de verdad las pulsaciones de los interruptores Zigbee y convertirlas en llamadas y atenciones, sin tocar nada de lo que ya funciona (pantallas, meseros, historial, demo, menú lateral, idiomas).

Tus claves `TUYA_CLIENT_ID` y `TUYA_CLIENT_SECRET` ya están guardadas de forma segura en el servidor. Nunca llegarán al navegador.

## Lo que Tuya necesita fuera de Lovable (importante)

Tuya ofrece dos formas de enviarte los eventos:

1. **Pulsar (Message Queue / Pulsar SDK)** — Tuya publica los eventos en una cola propia y tu servidor debe estar **conectado permanentemente** escuchando. Eso requiere un proceso que nunca se apaga; Lovable no puede mantener ese tipo de conexión abierta. Necesitarías un pequeño servidor aparte (por ejemplo un VPS o un contenedor) que escuche la cola de Tuya y reenvíe cada evento a la dirección segura que crearé aquí. Ese puente es la única pieza que va fuera.
2. **Webhook / "Message Service" con envío HTTP** — si tu cuenta de Tuya (plan y región) permite configurar una dirección de destino, Tuya envía cada evento directamente a Lovable y **no hace falta nada externo**. Esta es la opción preferida.

Primero comprobaré, con tus credenciales desde el servidor, a qué tiene acceso tu cuenta y te diré cuál de las dos aplica. Hasta confirmarlo, la integración seguirá marcada como "pendiente" en la pantalla de Integración, con el diagnóstico exacto.

## Lo que implemento dentro de Lovable

1. **Registro de interruptores por mesa**
   - Cada mesa (100–1000) guarda el **Device ID** de su interruptor.
   - El servidor identifica la mesa por el Device ID que llega en el evento, no por un número enviado desde fuera.

2. **Botones y tipo de pulsación configurables desde Administración**
   - Por mesa, dos menús: "Llamar al mesero" y "Marcar atendida".
   - Cada uno elige **interruptor (1–4)** y **tipo de pulsación** (sencilla, doble o larga).
   - Mesa 700 queda de prueba con: interruptor 3 + pulsación sencilla = llamar; interruptor 4 + pulsación sencilla = atendida.
   - Nada queda fijo en el código; otras mesas pueden usar otra combinación.
   - No se permite la misma combinación para las dos acciones, con aviso en inglés y español.

3. **Recepción segura de eventos**
   - Una dirección de entrada en el servidor que verifica la firma de Tuya antes de leer nada.
   - Cada evento trae un identificador único: si Tuya lo reenvía, se ignora (sin llamadas duplicadas).
   - Todo evento queda registrado: aceptado, ignorado o con error, con el motivo.
   - Se mantiene la regla actual: una sola llamada activa por mesa, tiempos del servidor, luces y cronómetros igual que hoy.

4. **Pruebas separadas de lo real**
   - Los eventos del hardware entran como producción; el panel de demostración sigue siendo aparte y no ensucia las estadísticas.
   - Añado un modo "prueba" visible en Integración: muestra en vivo los últimos eventos recibidos del hardware (mesa, interruptor, tipo de pulsación, resultado) para verificar la mesa 700 antes de dar la integración por buena.

5. **Estado honesto**
   - La pantalla de Integración dirá "conectada" solo después de ver una pulsación real del interruptor de la mesa 700 llegando al servidor.

## Detalles técnicos

- Nuevas columnas en `dining_tables`: `call_click_type`, `attend_click_type` y uso del Device ID como clave de resolución; migración con valores por defecto seguros (3/sencilla y 4/sencilla).
- La función atómica `ingest_button_event` se amplía para resolver la acción por (device_id o mesa) + interruptor + tipo de pulsación, conservando idempotencia, enfriamiento, atribución al mesero e historial.
- Punto de entrada `/api/public/tuya-events` con verificación de firma y, si aplica, descifrado del sobre de Tuya usando el secreto del cliente; solo en el servidor.
- Módulo `src/modules/tuya/` con el cliente de Tuya Cloud (token, consulta de dispositivos) encapsulado en funciones de servidor.
- Tabla de bitácora de eventos entrantes con motivo de rechazo para diagnóstico.

## Límite conocido

Si tu cuenta de Tuya solo ofrece Pulsar (cola de mensajes), necesitarás ese puente externo. Te entregaré el código del puente listo para copiar y las instrucciones, pero no puede ejecutarse dentro de Lovable.
