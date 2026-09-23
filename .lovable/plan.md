# Opción de parpadeo para la bombilla Server

## Objetivo
Permitir que un administrador elija cómo avisa la bombilla compartida **Server** cuando hay llamadas pendientes:

- **Rojo fijo**: funcionamiento actual.
- **Rojo parpadeante lento**: parpadeo continuo, aproximadamente cada 2 segundos, hasta atender la última llamada.

Cuando ya no quede ninguna llamada pendiente, la bombilla siempre volverá a **White**, sin apagarse definitivamente.

## Cambios
1. Añadir en **Configuración → Luz del área de meseros** un selector bilingüe EN/ES para elegir rojo fijo o parpadeo lento.
2. Guardar la selección globalmente para que se conserve después de recargar y se aplique a todas las llamadas reales.
3. Mantener intacta la lógica actual:
   - primera llamada pendiente activa la alerta;
   - atender una mesa mantiene la alerta si quedan otras pendientes;
   - atender la última mesa devuelve la bombilla a White;
   - las pruebas de demostración no controlan la bombilla física.
4. Mostrar el modo elegido y permitir **Aplicar ahora** desde la pantalla de Integración.
5. Registrar órdenes exitosas, errores y cambios de modo en el historial de integración.

## Implementación técnica
- Primero consultar las funciones reales expuestas por la bombilla Server para comprobar si admite una escena nativa de parpadeo.
- Si Tuya ofrece una función de escena compatible, usarla para que el parpadeo continúe en la propia bombilla sin depender de una página abierta.
- Si la bombilla no ofrece una escena nativa adecuada, implementar el ritmo mediante el proceso permanente de Railway, con una orden autenticada de iniciar/detener; no ejecutar un bucle permanente dentro de la aplicación web.
- Mantener las credenciales exclusivamente en servidor y validar permisos de administrador al cambiar la opción.
- No modificar la bombilla 701, las mesas 700/800, sus botones ni las automatizaciones de Smart Life.

## Verificación
- Probar ambos modos desde Administración.
- Crear una llamada: la bombilla debe parpadear lentamente en el modo nuevo.
- Crear dos llamadas y atender una: debe continuar parpadeando.
- Atender la última: debe quedar encendida en White.
- Cambiar a rojo fijo: debe recuperar exactamente el comportamiento actual.
- Confirmar que recargar pantallas no altera la alerta y que demo no envía órdenes físicas.

## Posible limitación
La viabilidad del parpadeo continuo sin cambios adicionales en Railway depende de las funciones que Tuya exponga para la bombilla Server. Si no admite una escena de parpadeo, Railway necesitará recibir y ejecutar la orden continua; esto se confirmará antes de elegir esa ruta.
