# Botón 4 = mesa atendida con un clic o doble clic, en todas las mesas

## Estado actual (ya revisado)
- Ya funciona así desde hoy a las 5:27 pm: en cualquier mesa, el botón 4 cierra la llamada con un clic, doble clic o dejándolo apretado.
- Todas las mesas (100 a 1000) usan ya botón 3 = llamar y botón 4 = atendida.

## Qué haré
1. Prueba en modo demo en cada mesa (100 a 1000): llamar con el 3 y atender una vez con un clic y otra vez con doble clic en el 4. Así no se tocan las llamadas reales ni las luces.
2. Revisar que ninguna pulsación del 4 aparezca como "ignorada" en esas pruebas.
3. Si alguna mesa falla, corregir solo esa mesa y avisarte cuál fue.

## Lo que no cambia
- Las luces, las automatizaciones de Smart Life, el diseño y los datos guardados.
- El botón 3 sigue llamando solo con un clic, para que no salgan llamadas por accidente.

## Detalle técnico
- `ingest_button_event` ya acepta cualquier tipo de clic cuando el botón es el `attend_button`, sin importar el tipo de clic configurado (migración 0006, ya aplicada en producción).
- La prueba llama la función con `environment='demo'` por cada mesa, con `single_click` y `double_click`.
