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
- [ ] Integración Tuya Message Service: botones 3/4 configurables por mesa, recepción de eventos segura, duplicados controlados,
      puente para Railway listo (auto-reconexión y procesamiento de mensajes pendientes). No publicar.

Hecho:
- [x] Botones físicos configurables por mesa (llamar/atender entre 1-4) en Configuración, con validación y resolución del mapeo en el servidor

- [x] Botones físicos configurables por mesa (llamar/atender entre 1-4) en Configuración, con validación y resolución del mapeo en el servidor
- [ ] Botonera móvil admin (/remote): botones Llamar/Atendida por mesa real, diseño v2 alto contraste; sync luz Server; EN/ES; no publicar
