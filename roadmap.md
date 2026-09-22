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
- [x] Menú en TV con PIN (flechas/OK/Volver) para asignación diaria de meseros
- [x] Registro de meseros y asignaciones diarias por fecha/turno con historial
- [x] Endpoint firmado para el gateway (`/api/public/tuya-events`), inactivo hasta configurar el secreto

Bloqueado por el usuario:
- [ ] Integración Tuya/Smart Life real: requiere el secreto de firma `TUYA_WEBHOOK_SECRET`
      y la configuración del gateway para enviar los eventos de botón 3/4.
      Hasta entonces el estado sigue siendo "pendiente" con diagnóstico en pantalla.
