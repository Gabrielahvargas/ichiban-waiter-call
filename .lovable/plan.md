# Ichiban Meseros — Sistema de llamadas hibachi

Interfaz 100% en español, pensada para TV grande y pantalla táctil, con arquitectura modular y backend real.

## Alcance de esta primera versión

1. **Pantalla de llamadas en tiempo real** (pantalla principal)
   - Tarjeta roja por mesa pendiente: número de mesa enorme en blanco y negrita, cronómetro amarillo en mm:ss algo más pequeño, texto auxiliar pequeño.
   - 1 llamada = pantalla completa; 2 llamadas = pantalla dividida en dos; 3+ = cuadrícula adaptable, ordenada por hora de llamada.
   - Al marcar atendida: cronómetro se detiene, tarjeta verde "ATENDIDA" con el tiempo final durante 10 s (configurable) y luego desaparece y se redistribuyen las tarjetas.
   - Aviso visible de desconexión cuando se pierde la conexión con el servidor.

2. **Modo DEMOSTRACIÓN** completamente funcional
   - Panel con las 10 mesas y botones simulados 3 y 4 por mesa.
   - Reloj real y registros reales, guardados por separado de los de producción.

3. **Configuración** (editable desde la interfaz)
   - Salida: televisor, computadora táctil o ambos sincronizados.
   - Regla de nueva llamada tras atención: inmediata, tras 10 s o tras 30 s.
   - Alertas sonoras: cada llamada / solo espera excesiva / ninguna, con umbral de espera.
   - Duración de tarjeta verde (10 s por defecto) y de rojo local (3 s).
   - Color de la luz compartida del área de meseros.
   - Foco de alerta elegible por mesa (101/102 … 1001/1002).
   - Retención de registros.
   - Mapa de identificadores reales de botones, focos y gateway.

4. **Historial y estadísticas**
   - Lista de llamadas con hora de llamada, hora de atención y duración.
   - Tiempo promedio, tiempo máximo y volumen por mesa y por hora.

5. **Administración**
   - Cuentas individuales para la dueña y otros administradores (correo y contraseña).
   - Configuración, historial y mapeo de dispositivos solo para administradores; la pantalla de llamadas queda accesible para operación.

6. **Integración Tuya / Smart Life**
   - Pantalla de estado de integración que queda en **"pendiente"**: no se inventan endpoints, credenciales ni conexiones.
   - Los secretos se guardarán solo en el servidor cuando la dueña los proporcione.
   - Se marcará "verificada" únicamente tras comprobar eventos reales de botón 3/4 y control de luces.
   - Sin promesas de control sin conexión: el funcionamiento local solo se habilitará si el hardware realmente lo soporta.

## Reglas de negocio

- Botón 3 = llamar; botón 4 = atendida.
- Una sola llamada activa por mesa; el botón 3 se ignora mientras haya una pendiente (sin duplicados).
- Tras atender, la mesa vuelve a poder llamar según la regla configurada (inmediata / 10 s / 30 s).
- Luz compartida del área de meseros en rojo mientras exista al menos una llamada pendiente; vuelve a su color anterior solo cuando no queda ninguna.
- Al pulsar botón 3, el foco elegido de esa mesa pasa a rojo 3 s y luego recupera su color anterior.
- Las horas y duraciones las fija el servidor; los eventos son idempotentes y el estado sobrevive a una recarga.

## Detalles técnicos

- Backend con Lovable Cloud: tablas `mesas`, `dispositivos`, `focos`, `llamadas`, `eventos`, `configuracion`, `perfiles`, `roles_usuario`; marcas de tiempo del servidor, clave de idempotencia por evento, y separación `entorno = produccion | demo`.
- Seguridad por filas en todas las tablas; roles en tabla aparte (`roles_usuario`) con función `has_role`.
- Actualización en vivo mediante suscripción en tiempo real a la tabla de llamadas, para que TV y pantalla táctil se mantengan sincronizadas.
- Módulos separados en el código: `mesas-dispositivos`, `ingesta-eventos`, `maquina-estados-llamadas`, `iluminacion`, `pantalla-tiempo-real`, `historial-estadisticas`, `autenticacion`, `configuracion`, `conectores` (adaptador Tuya encapsulado, sin implementación falsa).
- Endpoint público de ingestión preparado para el gateway, con verificación de firma, inactivo hasta que se configure.
- Nada se publica ni despliega.

## Supuestos

- El nombre del proyecto ("meseros") lo cambia la dueña desde los ajustes de Lovable; no puedo renombrarlo desde aquí.
- Se creará la primera cuenta de administradora al registrarse; las demás se invitan desde Administración.
- El sonido de alerta usará un tono generado en el navegador.
