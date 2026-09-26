# Subir el número de mesa para que se vea el nombre del mesero en la TV

## Resultado
- En la pantalla de llamadas, la tarjeta se centrará un poco más arriba, de modo que el **nombre del mesero** quede dentro del área visible del televisor (720p) junto al número de mesa y el cronómetro.
- Sin barra de desplazamiento y sin recortar textos; el número de mesa y el cronómetro siguen siendo lo más grande y prominente.

## Cambios (mínimos)
- `src/components/CallCard.tsx`: en las densidades con varias llamadas (`grid` y `compact`), compensar el centrado hacia arriba (margen/padding inferior adicional) y apretar ligeramente los espacios entre renglones, para que el bloque completo — etiqueta, número, cronómetro y nombre del mesero — quepa dentro de la tarjeta en 1280×720.
- El nombre del mesero conserva su truncado y tamaño responsivo actuales; no se cambia ninguna otra vista ni módulo.

## Verificación
- Probar en el navegador a 1280×720 con 1, 2 y 6 llamadas (y una vista vertical) confirmando que el nombre del mesero se ve completo en la tarjeta.
- Revisar que la compilación no tenga errores.

## Nota de publicación
- Este cambio queda en la vista previa. Para verlo en la TV/tablet hay que publicar la aplicación (solo cuando tú lo pidas).
