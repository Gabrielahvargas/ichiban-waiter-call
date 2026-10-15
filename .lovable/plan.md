# La segunda luz SERVER no se pone roja

## Qué encontré
- Hoy a las 15:08 la app volvió a buscar las luces llamadas SERVER y **solo encontró una** (`eb15a95d8e1165e21bdxqv`). Desde entonces solo esa recibe el rojo y el blanco, y le llegan sin errores.
- La otra luz (la que conectaste al final) no aparece en la búsqueda. Al volver a vincularla en Smart Life, Tuya le da un **identificador nuevo**, y algo impide que la app la reconozca. Puede ser que el nombre no sea exactamente "SERVER" (espacio de más, "Server 2", otro texto), que Tuya la registre como otro tipo de aparato, o que todavía no esté vinculada al proyecto de Tuya.
- Todavía no sé cuál de estas es la causa. Lo primero es confirmarlo.

## Pasos
1. **Revisar en Tuya** todos los aparatos cuyo nombre contenga "server", sin importar mayúsculas, espacios ni tipo. Así veo el identificador nuevo, el nombre exacto, el tipo de aparato y si está en línea. No se inventa ningún identificador.
2. **Arreglar la causa que salga**:
   - Si el nombre es un poco distinto: hacer que la búsqueda acepte el nombre sin importar mayúsculas ni espacios extra. Si el nombre es otro, te digo exactamente cómo renombrarla en Smart Life.
   - Si Tuya la registra como otro tipo de luz: hacer que la búsqueda acepte cualquier tipo de luz, no solo uno.
   - Si no está vinculada al proyecto de Tuya: te digo los pasos en Smart Life o en la plataforma de Tuya para vincularla.
3. **Guardar las dos luces** en Configuración y mostrarlas en la página Integración. Además, si una luz desaparece un momento de la búsqueda, la app no la va a borrar sola de la lista mientras la otra siga respondiendo.
4. **Probar en la vista previa**: hago una llamada de prueba y confirmo en el registro que **las dos** reciben rojo y después blanco. Luego borro la llamada de prueba.

No se cambian las luces de las mesas ni las automatizaciones. Nada se publica sin tu permiso. Ojo: la app publicada necesita publicarse para recibir este arreglo.

## Detalles técnicos
- `findLightsByName` (`src/lib/tuya.server.ts`) hoy compara el nombre exacto y solo acepta la categoría `dj`. La nueva versión compara el nombre sin importar mayúsculas ni espacios y acepta las categorías de luz (`dj`, `dd`, `fwd`, `xdd`, `dc`).
- `relinkSharedLightByName` (`shared-light.server.ts`): fusionar las luces encontradas con los IDs guardados que sigan en línea, en lugar de reemplazar toda la lista.
