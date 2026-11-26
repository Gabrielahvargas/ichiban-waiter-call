# Mesas fijas mientras bajas por la lista de meseras

## Qué cambia
En la pantalla de Asignaciones (TV/tablet), el bloque de mesas (100–1000) se quedará fijo a la derecha mientras bajas por la lista de nombres de meseras. Así siempre puedes elegir una mesera y tocar la mesa sin perderla de vista. La fecha y Lunch/Dinner siguen fijas arriba.

En teléfono (pantalla angosta, una sola columna) las mesas quedarán fijas arriba de la lista de nombres, justo debajo de la fecha.

## Qué no cambia
Luces, botones 3/4, FIRE/SHOW/HAPPY, Tuya, Smart Life, Railway, base de datos, credenciales, ni la forma de asignar.

## Prueba
Simular la TV 1280x720 con muchas meseras, bajar por la lista y confirmar en captura que las mesas siguen visibles y que el control remoto (flechas/OK) sigue funcionando. Luego queda listo para publicar cuando lo pidas.

## Detalle técnico
En `AssignOverlay` (src/routes/screen.tsx), la columna de mesas usa `sticky` con `top` igual a la altura de la barra de fecha/turno y `self-start`; en móvil se reordena antes de la lista con fondo sólido.
