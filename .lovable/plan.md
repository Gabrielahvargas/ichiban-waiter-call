# Evitar el aviso "Conexión perdida — reconectando" constante en la tablet

## Qué pasa hoy
- La pantalla consulta el servidor cada 2 segundos. Si **una sola** consulta falla (un corte breve del Wi‑Fi, la tablet ahorrando batería, o la vista previa reiniciándose mientras hago cambios), el aviso cambia a "reconectando".
- El mismo aviso aparece también mientras la pantalla está arrancando, aunque no haya ningún problema.
- La tablet usa la dirección de **vista previa**, que se reinicia cada vez que edito la aplicación; eso también provoca cortes breves.

## Qué voy a cambiar
1. **Tolerancia a cortes breves**: solo mostrar "Conexión perdida" si fallan 3 consultas seguidas (unos 6–8 segundos). Un fallo aislado no cambia nada en pantalla.
2. **Arranque distinto de desconexión**: al abrir la pantalla mostrar "Conectando…" en lugar de "Conexión perdida".
3. **Reintento inmediato** al volver la tablet a primer plano o al recuperar la red, para que el aviso desaparezca enseguida.
4. Las llamadas y cronómetros siguen visibles durante un corte (ya ocurre así, se conserva).
5. Textos nuevos en inglés y español.

## Recomendación para uso diario
Usar la versión **publicada** (`https://ping-serve-ease.lovable.app/screen`) en la tablet, porque la vista previa se reinicia con cada cambio. Requiere publicar la aplicación cuando lo decidas (no publicaré sin tu permiso) y volver a emparejar la tablet.

## Detalles técnicos
- `useScreenState` (`src/modules/screens/api.ts`): contador de fallos consecutivos; `offline` solo con ≥3; reset al éxito; listeners `visibilitychange` y `online` que llaman `load()`.
- `screen.tsx`: distinguir `connecting` (clave nueva `screen.connecting`) de `offline`.
- Sin cambios de base de datos, mesas, botones ni luces.
