# Ichiban Waiter Call

Crea proyecto llamado exactamente "meseros" para Ichiban, interfaz completamente en español. Construye primera versión modular y extensible de sistema de llamadas de meseros hibachi, con diseño profesional optimizado para TV grande y pantalla táctil y responsive. Hay 10 mesas: 100,200,300,400,500,600,700,800,900,1000, cada una dos focos (101/102,201/202,...,1001/1002) y un dispositivo de 4 botones. Botón 3 llama; botón 4 marca atendida. Foco de alerta de cada mesa elegible en Configuración. Pantalla de llamadas en tiempo real: cada mesa pendiente tiene tarjeta roja, número de mesa muy grande blanco en negrita, cronómetro amarillo ligeramente más pequeño en mm:ss y texto auxiliar pequeño. Con dos llamadas dividir pantalla en dos; con más llamadas distribuir en cuadrícula adaptable y ordenar por hora de llamada. Al botón 4 detener cronómetro, guardar hora y duración, mostrar tarjeta verde "ATENDIDA" con tiempo final durante 10 segundos, luego desaparecer y redistribuir tarjetas. Cada mesa tiene una sola llamada activa; evitar duplicados de botón 3 mientras pendiente. Tras atención, nueva llamada configurable: inmediata, después de 10 s o después de 30 s. Luz compartida del área de meseros roja mientras al menos una llamada pendiente; volver a color previo solo cuando ninguna pendiente. Al botón 3 cambiar un foco elegido de la mesa a rojo durante 3 segundos y restaurar color anterior. Separar arquitectura por módulos: mesas/dispositivos, ingestión de eventos, máquina de estados de llamadas, control de iluminación, pantalla en tiempo real, historial y estadísticas, autenticación/administradores, configuración, conectores de terceros. Backend persistente para llamadas, eventos, timestamps servidor, duración, historial con retención configurable, métricas de tiempos promedio, máximo y volumen por mesa y hora. Administración para dueña y otros administradores con cuentas individuales. Configuración editable en UI: salida televisor, computadora táctil o ambos sincronizados; regla de nueva llamada; alertas sonoras (cada llamada, solo espera excesiva, ninguna); umbral de espera; duración de tarjeta verde por defecto 10 s; duración rojo local 3 s; color luz compartida; selección foco alerta por mesa; retención de logs; mapa identificadores reales de botones, focos y gateway. Detección de desconexión y aviso visible; funciones locales offline únicamente si dispositivos/gateway realmente soportan ejecución local; no prometer control offline desde app web sin conectividad. Integración Tuya/Smart Life encapsulada en adaptador backend seguro con secretos solo servidor, webhooks/eventos y API comandos donde esté soportado; NO inventar endpoints, credenciales ni afirmar que se ha conectado; dejar pantalla de configuración y estado de integración 'pendiente' hasta configurar y verificar eventos botón 3/4 y control luces. Crear modo DEMOSTRACIÓN completamente funcional con botones simulados por mesa 3/4, reloj real y registros reales separados de producción, para probar sin hardware. Manejar simultaneidad de varias mesas, idempotencia de eventos y persistencia tras recarga. No publicar ni desplegar sin solicitud. Priorizar UI y arquitectura modular limpia con componentes separados, tipos y servicios.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4c9885f1-6388-4131-bccc-9817a174abd7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
