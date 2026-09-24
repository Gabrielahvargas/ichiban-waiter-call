# Pantalla de llamadas sin desplazamiento en TV 720p

## Resultado
- La pantalla emparejada **Ichiban** ocupará exactamente el alto visible del televisor y no permitirá desplazamiento.
- Con **6 llamadas**, se mostrarán las seis simultáneamente en una cuadrícula de **3 columnas × 2 filas** cuando el dispositivo esté horizontal.
- Las tarjetas conservarán el diseño actual: rojo para pendientes, número de mesa grande, cronómetro amarillo y confirmación verde al atender.
- Con menos o más llamadas, la distribución seguirá adaptándose al espacio disponible sin cortar contenido.
- La orientación vertical existente seguirá funcionando.

## Implementación
- Limitar la vista independiente `/screen` al alto real del dispositivo y ocultar el desbordamiento únicamente en el modo de llamadas.
- Dar a la cuadrícula filas de altura uniforme que puedan reducirse dentro del espacio restante después del encabezado.
- Elegir las columnas según orientación y cantidad de llamadas, no solo mediante el ancho informado por el navegador del televisor.
- Añadir una variante compacta de las tarjetas cuando haya varias llamadas para que número, cronómetro y textos quepan dentro de cada fila.
- No modificar el panel administrativo, emparejamiento, llamadas, cronómetros, luces, Tuya ni datos existentes.

## Verificación
- Probar la pantalla en **1280×720** con 1, 2 y 6 llamadas.
- Confirmar que 6 tarjetas sean visibles completas, sin barra de desplazamiento ni superposición.
- Comprobar también una vista vertical y que los cronómetros sigan actualizándose.
- Revisar que el proyecto quede sin errores.
