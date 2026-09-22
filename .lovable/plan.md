# Conexión con Tuya Cloud — plan corregido

Ya confirmaste que Tuya Message Service recibe eventos reales del interruptor de la mesa 700 (`switch_type_3` = pulsación sencilla, `switch_type_4` = pulsación sencilla). El plan se basa en eso: **Message Service + puente permanente**, sin sondeo.

Tus claves `TUYA_CLIENT_ID` y `TUYA_CLIENT_SECRET` ya están guardadas en el servidor y nunca llegan al navegador.

## 1. Arquitectura elegida

```text
Interruptor Zigbee  ->  Gateway  ->  Tuya Cloud (Message Service)
                                          |  conexión permanente
                                     Puente (fuera de Lovable)
                                          |  HTTPS firmado
                                   Lovable: /api/public/tuya-events
                                          |
                                  Llamadas, luces, historial
```

El puente es un programa muy pequeño que se mantiene conectado a la cola de Tuya, descifra el mensaje con tu secreto y reenvía cada evento a Lovable firmado. Lovable no puede mantener esa conexión abierta por sí mismo; todo lo demás sí se hace aquí.

## 2. Sobre el sondeo cada 10 segundos

Verificado en este proyecto: la extensión de tareas programadas de la base de datos está disponible en versión 1.6, que **sí admite intervalos de segundos**. Aun así **no se va a usar**, por dos razones: el registro de la API de Tuya no garantiza devolver todas las pulsaciones (agrupa y puede omitir eventos rápidos), y añadiría retraso en una pantalla que debe ser inmediata. Queda descartado salvo que tú lo pidas como respaldo.

## 3. Lo que implemento dentro de Lovable

1. **Interruptor por mesa**
   - Cada mesa (100–1000) guarda el **Device ID** de su interruptor.
   - El servidor identifica la mesa por ese Device ID, no por un número que venga de fuera.

2. **Botón y tipo de pulsación configurables por mesa**
   - Dos menús por mesa: "Llamar al mesero" y "Marcar atendida".
   - Cada uno elige **interruptor 1–4** y **tipo de pulsación** (sencilla, doble o larga).
   - Mesa 700 preconfigurada: interruptor 3 + sencilla = llamar; interruptor 4 + sencilla = atendida.
   - No se permite la misma combinación para las dos acciones; aviso en inglés y español.
   - Nada fijo en el código: cada mesa puede ser distinta.

3. **Recepción segura**
   - La dirección de entrada verifica la firma antes de leer nada.
   - Cada evento trae identificador único: si se reenvía, se ignora (sin llamadas duplicadas).
   - Todo queda registrado: aceptado, ignorado o con error, con el motivo.

4. **Pruebas separadas de lo real**
   - El hardware entra como producción; el panel de demostración sigue aparte y no afecta estadísticas.
   - En Integración, una vista en vivo de los últimos eventos del hardware (mesa, interruptor, tipo de pulsación, resultado) para verificar la mesa 700.
   - "Conectada" solo se muestra tras ver una pulsación real llegando al servidor.

5. **Nada se pierde**
   - Llamadas, historial, meseros, asignaciones, pantallas emparejadas, luces, cronómetros, idiomas y el menú lateral quedan exactamente igual. Solo se añaden columnas y una bitácora.

## 4. Alojar el puente: opción más sencilla y costo

| Opción | Dificultad | Costo aprox. |
| --- | --- | --- |
| **Railway o Render** (recomendado) | Subes el código, pegas 3 valores y listo | ~5 USD/mes (Render tiene capa gratuita que se duerme, no sirve aquí) |
| **Fly.io** | Requiere instalar una herramienta de línea de comandos | ~2–3 USD/mes |
| **Mini PC / Raspberry Pi en el restaurante** | Hay que dejarlo siempre encendido y con internet | Costo del equipo, sin mensualidad |

Recomendación: **Railway**, ~5 USD al mes. Lo que tendrías que configurar allí son cuatro valores que yo te entrego: identificador y secreto de Tuya, la región de tu cuenta, la dirección de Lovable y una clave compartida de firma. Yo entrego el código del puente listo y las instrucciones paso a paso.

## 5. Detalles técnicos

- `dining_tables`: se añaden `call_click_type`, `attend_click_type` y se usa el Device ID como clave de resolución; migración con valores por defecto (3/sencilla, 4/sencilla) para no romper filas existentes.
- `ingest_button_event` resuelve la acción por (Device ID o mesa) + interruptor + tipo de pulsación, conservando idempotencia, enfriamiento, atribución al mesero e historial.
- `/api/public/tuya-events`: verificación HMAC con una clave compartida entre puente y Lovable (secreto nuevo, distinto de las claves de Tuya).
- Tabla de bitácora de eventos entrantes con motivo de rechazo.
- Código del puente en `bridge/` dentro del proyecto, documentado, sin ejecutarse en Lovable.
- No se publica ni despliega nada.

## 6. Único paso que depende de ti

Crear una clave compartida de firma y guardarla tanto en Lovable como en el puente. Te lo pediré cuando la dirección de entrada esté lista.
