# Orientación vertical / horizontal por pantalla

Cada pantalla emparejada (tablet o TV) tendrá su propia orientación: **Horizontal** (predeterminada) o **Vertical**. Se puede cambiar desde el panel de administración y desde el menú del propio dispositivo (con PIN).

## Qué verá el usuario
- **Admin → Pantallas**: al crear una pantalla y en cada tarjeta, un selector "Orientación: Horizontal / Vertical". Se guarda con el botón Guardar.
- **Menú del dispositivo (OK del control → PIN)**: nueva opción "Orientación" que alterna Horizontal/Vertical con flechas y OK. Se aplica al instante y se guarda en el servidor, así el admin ve el mismo valor.
- **Vertical**: la pantalla de llamadas gira 90° para TVs montadas de lado (el navegador sigue en horizontal), y la cuadrícula de tarjetas se reorganiza para ese formato (1 llamada = completa, 2 = arriba/abajo, más = cuadrícula de 2 columnas). En tablets que ya están de pie no se gira doblemente: si la ventana ya es vertical, sólo se usa el diseño vertical.
- Cambiar orientación no reinicia cronómetros ni pierde llamadas; el diseño de las tarjetas se mantiene.
- Textos en inglés (predeterminado) y español.

## Detalles técnicos
- Migración: `display_screens.orientation text not null default 'landscape' check in ('landscape','portrait')`.
- `screen_state` devuelve `screen.orientation`.
- Nueva RPC `screen_set_orientation(p_screen_id, p_device_token, p_pin_session, p_orientation)` que valida token del dispositivo + sesión PIN vigente (mismo patrón que las asignaciones del menú); grants solo a anon/authenticated vía RPC, sin exponer datos.
- `admin_create_screen` acepta `p_orientation` opcional; `updateScreen` incluye `orientation`.
- `types.ts`: `DisplayScreen.orientation`, `ScreenState.screen.orientation`.
- `screens.tsx`: selector en formulario de alta y en `ScreenCard`.
- `screen.tsx`: opción en `MenuOverlay`; contenedor rotado con CSS (`rotate(90deg)`, ancho/alto intercambiados) cuando es vertical y la ventana es horizontal; pasa prop de orientación a `CallGrid` para las reglas de distribución.
- i18n: claves `screens.orientation`, `screens.landscape`, `screens.portrait`, `screen.orientation` en en/es.
