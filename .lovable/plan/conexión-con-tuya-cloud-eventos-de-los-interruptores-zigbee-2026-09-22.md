# Conexión con Tuya Cloud (eventos de los interruptores Zigbee)

Objetivo: que al pulsar el mando físico de una mesa, la app cree o cierre la llamada real,
sin exponer credenciales en el navegador y sin romper nada de lo que ya funciona.

## Qué puedo hacer dentro de Lovable y qué no

Tuya ofrece dos caminos para recibir eventos:

1. **Message Service (cola de mensajes Pulsar/AMQP)** — necesita un proceso encendido
   24/7 conectado a Tuya. El servidor de esta app se despierta solo cuando llega una
   petición, así que **esa conexión permanente no puede vivir dentro de Lovable**.
   Requiere infraestructura extra tuya: un pequeño servicio siempre activo
   (por ejemplo un contenedor en Railway/Fly/Render o una Raspberry Pi en el local)
   que escuche la cola y reenvíe cada evento a la dirección segura de esta app.
   Te dejaré preparado el punto de entrada y un script de puente listo para copiar.

2. **Consulta periódica a Tuya Cloud (API REST)** — esto **sí lo implemento completo
   aquí y ahora**, con tus claves ya guardadas. Cada pocos segundos el servidor
   pregunta a Tuya por los últimos registros de cada mando y convierte cada pulsación
   en una llamada. Es la opción que no necesita ninguna máquina adicional.
   Latencia típica: unos segundos.

Plan: implementar el camino 2 como vía principal, y dejar el camino 1 listo para
enchufar (misma lógica de procesamiento) por si quieres latencia inmediata.

## Lo que se construye

**1. Identificar cada mando por su Device ID**
- En Configuración, cada mesa ya tiene un campo de identificador de dispositivo.
  Lo convierto en el enlace oficial mando → mesa y añado un botón "Detectar":
  lista los dispositivos que Tuya reporta en tu cuenta para que elijas el correcto
  en vez de escribirlo a mano.

**2. Botón y tipo de pulsación configurables**
- A los dos menús que ya existen por mesa ("Llamar al mesero" / "Marcar atendida")
  les añado un selector de tipo de pulsación: clic simple, doble o largo.
  Nada queda fijo: la mesa 700 se guarda como botón 3 + clic simple para llamar y
  botón 4 + clic simple para atender, y cualquier otra mesa puede usar otra combinación.
- Se sigue validando que llamar y atender no usen la misma combinación, con aviso
  en inglés y español.

**3. Procesamiento seguro de eventos**
- Las claves de Tuya se usan solo en el servidor; el navegador nunca las ve.
- Cada evento trae un identificador único; si llega repetido se ignora
  (ya existe esa protección y se mantiene).
- Se registra cada evento recibido, aceptado o rechazado, con su motivo,
  y los errores de Tuya quedan guardados para poder diagnosticar.

**4. Pruebas separadas de lo real**
- Todo lo que llega desde Tuya se marca como producción; el panel de demostración
  sigue guardando en su propio entorno y no contamina las estadísticas.

**5. Pantalla de Integración renovada**
- Estado real de la conexión con Tuya (credenciales válidas o no), lista de
  dispositivos detectados, último evento recibido por mesa, últimos errores
  y la dirección exacta para el puente, todo en inglés y español.

## Detalle técnico

- Guardado: `dining_tables` gana `call_click_type` y `attend_click_type`
  (por defecto `single`); la resolución sigue haciéndose en el servidor dentro de
  `ingest_button_event`, que ya recibe el número de interruptor y el tipo de clic.
- Nueva tabla `tuya_event_log` (evento crudo, device_id, mesa resuelta, resultado, error).
- Módulo servidor `src/lib/tuya.server.ts`: firma HMAC-SHA256 de Tuya, token de acceso
  con caché, `GET /v1.0/iot-03/devices` y consulta de registros de dispositivo.
- Server functions para el panel: listar dispositivos, probar credenciales, ver log.
- Sondeo: ruta `src/routes/api/public/tuya-poll.ts` protegida con `LOVABLE_CRON_SECRET`,
  llamada por pg_cron cada 10 s; lee los registros nuevos de cada mando registrado
  y los pasa por `ingest_button_event` con clave de idempotencia `deviceId:timestamp:code`.
- Puente opcional: se mantiene `/api/public/tuya-events` con firma HMAC
  (`TUYA_WEBHOOK_SECRET`) y añado el script del puente Pulsar en el repo, documentado.
- Sin cambios en Host, pedidos ni despliegue.

## Lo que necesitaré de ti después

- Confirmar en la pantalla de Integración que tus mandos aparecen y asignarlos a su mesa.
- Pulsar el botón 3 en la mesa 700 para verificar el primer evento real.
- Solo si quieres latencia instantánea: levantar el puente de la cola de mensajes.
