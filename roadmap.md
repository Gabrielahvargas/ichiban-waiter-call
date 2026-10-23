# Ichiban Meseros — Roadmap

- [x] Backend (Lovable Cloud): mesas, dispositivos, focos, llamadas, eventos, configuración, perfiles, roles
- [x] Máquina de estados de llamadas + idempotencia + timestamps de servidor
- [x] Pantalla de llamadas en tiempo real (TV / táctil, cuadrícula adaptable)
- [x] Modo demostración con botones 3/4 simulados por mesa
- [x] Configuración editable en UI (incluye PIN, zona horaria, inicio de cena)
- [x] Historial y estadísticas (filtros fecha/turno/mesero/mesa, métricas por mesero)
- [x] Autenticación y administradores
- [x] Control de iluminación (luz compartida + rojo local 3 s)
- [x] Bilingüe EN/ES, inglés por defecto, cambio en caliente sin reiniciar cronómetros
- [x] Pantallas independientes emparejadas (código temporal, sesión de dispositivo, latido, gestión desde admin)
- [x] Registro de meseros y asignaciones diarias por fecha/turno con historial
- [x] Menú de administración en barra lateral izquierda, colapsable a iconos y se oculta automáticamente al navegar
- [x] Endpoint firmado para el gateway (`/api/public/tuya-events`), inactivo hasta configurar el secreto

En progreso:
- [x] Revisar integración de llamadas; mesa 200 configurada 1/2 y otras mesas conservadas 3/4.
- [x] Probar llamadas reales controladas de 200 y 500: pantalla pendiente/atendida, historial, duplicados y envío independiente a ambos SERVER; 26 pruebas automáticas aprobadas.
- [ ] Confirmar encendido físico de ambos SERVER: Tuya rechaza las órdenes con 2001 device is offline; requiere reconectar los dispositivos/gateway y nueva pulsación física.
- [x] Integración Tuya Message Service: recepción física confirmada en producción; puente Railway con 23 pruebas aprobadas. Sin publicar cambios de código.

Hecho:
- [x] Botones físicos configurables por mesa (llamar/atender entre 1-4) en Configuración, con validación y resolución del mapeo en el servidor

- [x] Botones físicos configurables por mesa (llamar/atender entre 1-4) en Configuración, con validación y resolución del mapeo en el servidor
- [x] Botonera móvil admin (/remote): botones Llamar/Atendida por mesa real, diseño v2 alto contraste; sync luz Server; EN/ES; no publicar
