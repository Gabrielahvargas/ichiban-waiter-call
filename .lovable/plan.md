# Que el botón "Apagar todas" apague los dos focos de cada mesa

## Lo que ya revisé
El registro de la app muestra que, en mesas 200, 400, 500, 600, 700, 800 y 900, **uno de los dos focos recibe la orden y el otro la rechaza** (dice "falló 1 de 2 focos"). Solo la mesa 300 apaga sus dos focos. La app sí manda la orden a los dos focos. Quien la rechaza es Tuya.

Ahora mismo la app no guarda **por qué** Tuya rechaza el segundo foco, así que la causa no está confirmada. Puede ser alguna de estas:
- Se acabó el cupo del servicio de Tuya.
- Ese foco no está vinculado al proyecto de Tuya que usa la app.
- El foco está desconectado.

## Qué voy a hacer
1. **Guardar el motivo exacto de cada foco.** En el registro quedarán qué foco falló y el mensaje de Tuya. Con eso sabremos la causa real.
2. **Hacer una prueba controlada** con la botonera: apagar y luego encender todo, y leer los motivos.
3. **Corregir según la causa:**
   - Si es el cupo o la vinculación, te digo en palabras simples qué pulsar en la página de Tuya. Desde la app no se puede arreglar.
   - Si el foco está desconectado, te digo cuál es, para que lo revises en el restaurante.
   - Si Tuya rechaza la orden porque llegan muchas al mismo tiempo, la app mandará las órdenes de una en una, con un reintento.
4. **Mejorar el aviso de la botonera.** Dirá "Mesa 500: 1 de 2 focos sin responder" y el motivo, no solo "falló".

No cambio las luces SERVER, las llamadas, los botones físicos ni las automatizaciones de Smart Life. No publico nada.

## Detalles técnicos
- `sendGroupCommands` en `src/lib/tuya.server.ts` devolverá un resultado por foco (`dev_id`, `code`, `msg` de Tuya) en lugar de lanzar un error genérico.
- `src/lib/show-all.functions.ts` guardará esos detalles en `tuya_event_log.error` y en `raw`, y los devolverá a la botonera.
- Si los códigos son de límite de frecuencia, se mandarán las órdenes en secuencia con un reintento.
- Textos nuevos en EN/ES.
