# Ranking de ventas (alcohol y sushi por mesero) con Tabit Cloud

## Hallazgo clave
Tabit Cloud no tiene una API pública: no hay documentación, ni dirección ni forma de acceso publicadas. El acceso se pide a Tabit mediante su programa de socios. Por eso no se inventará ninguna conexión: se deja un conector aislado, listo para completar en cuanto Tabit entregue la documentación, y la pantalla dirá claramente "Fuente de datos sin configurar".

## Qué verá el usuario
- Nueva página **Ranking de ventas** en el menú lateral (solo administradores).
- Tarjetas: líder de alcohol, líder de sushi, total de unidades y total vendido por categoría.
- Tabla por mesero, ordenable por cualquier columna (unidades/importe de alcohol y sushi).
- Filtros: rango de fechas, turno (comida/cena/todos), cambiar entre **unidades** e **importe**, y **Real / Demo**.
- Barra de estado: última sincronización, estado de conexión (sin configurar / conectado / error), próximo intento, botón **Actualizar ahora**.
- Modo **Demo** claramente etiquetado, con ventas de ejemplo solo para revisar el diseño.
- En Configuración: reglas de clasificación (categoría de Tabit o palabra clave → alcohol / sushi / ignorar) para corregir la clasificación.
- Instrucciones dentro de la página: qué datos pedir a Tabit, dónde guardarlos de forma segura, zona horaria (usa la del restaurante ya configurada) y cómo mapear categorías.

## Detalles técnicos
- Tablas nuevas (con permisos solo para administradores):
  - `sales_sync_state` (cursor/última venta procesada, último intento, próximo intento, estado, error, reintentos)
  - `sales_sync_runs` (log mínimo de cada sincronización)
  - `sales_waiters` (mesero externo de Tabit ↔ mesero local opcional)
  - `sales_items` (venta normalizada: id externo único, fecha, turno, mesero, producto, categoría Tabit, categoría resuelta, cantidad, importe, entorno real/demo)
  - `sales_category_rules` (tipo: categoría o palabra clave, patrón, destino, prioridad)
- Duplicados: índice único por (entorno, id externo) + upsert; cursor guardado tras cada lote.
- Conector `src/lib/tabit/adapter.server.ts` con interfaz `fetchSalesSince(cursor)`; la implementación real queda como "no configurada" hasta tener la documentación oficial. Secretos esperados: `TABIT_API_BASE_URL`, `TABIT_API_KEY` (y los que Tabit indique), nunca en el navegador.
- Sincronización: función de servidor (manual, solo admin) + ruta pública protegida con secreto para el programador automático cada 30 min (pg_cron). Reintentos con espera creciente (5, 10, 20 min… máx. 30) y registro de errores.
- Clasificación en servidor: reglas del usuario primero, luego categoría de Tabit, luego palabras clave por defecto (sake, beer, cerveza, wine, cocktail… / roll, nigiri, sashimi, maki…).
- Textos EN/ES en las traducciones centrales; inglés por defecto.
- Datos de ejemplo de demo insertados una sola vez en la tabla con entorno `demo`.
- Pruebas pequeñas para la clasificación y el ranking.
- Verificación en vista previa: ranking, filtros de fecha, Actualizar ahora (debe mostrar "sin configurar" en real) y estado de sincronización.
- Sin publicar.
