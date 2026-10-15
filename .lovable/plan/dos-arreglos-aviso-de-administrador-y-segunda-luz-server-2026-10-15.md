# Dos arreglos: aviso de administrador y segunda luz SERVER

## 1. Aviso "Necesitas acceso de administrador" (primero)

### Qué encontré
- Tu usuario gabrielahvargas@gmail.com **sí es administrador**. Lo revisé en la base de datos.
- La causa del aviso está en la app: al abrir un menú, la página confirma primero que iniciaste sesión y después, por separado, revisa si eres administradora. Entre los dos pasos la trata como si no lo fueras y muestra el aviso. Si esa segunda revisión tarda o falla (por ejemplo, con mala conexión), el aviso se queda en pantalla.

### Arreglo
- La página muestra "Cargando…" hasta que termina de revisar si eres administradora. El aviso solo sale cuando de verdad no lo eres.
- Si la revisión falla por la conexión, se reintenta sola en lugar de mostrar el aviso.
- Lo pruebo en la vista previa con tu usuario, entrando a Configuración, Administradores, Integración y Ranking de ventas.

## 2. La segunda luz SERVER no se pone roja

### Qué encontré
- Hoy a las 15:08 la app volvió a buscar las luces llamadas SERVER y **solo encontró una** (`eb15a95d8e1165e21bdxqv`). Desde entonces solo esa recibe el rojo y el blanco.
- La que conectaste al final no aparece. Al vincularla de nuevo en Smart Life, Tuya le da un identificador nuevo. Puede ser que el nombre no sea exactamente "SERVER", que Tuya la registre como otro tipo de aparato, o que no esté vinculada al proyecto de Tuya. Todavía no sé cuál de las tres es; primero lo confirmo.

### Pasos
1. Buscar en Tuya todos los aparatos con "server" en el nombre, sin importar mayúsculas, espacios ni tipo. No se inventa ningún identificador.
2. Arreglar según lo que salga: hacer la búsqueda más flexible con el nombre y el tipo de luz, o explicarte qué cambiar en Smart Life o Tuya.
3. Guardar las dos luces. Si una desaparece un momento de la búsqueda, la app no la borra de la lista mientras siga respondiendo.
4. Hacer una llamada de prueba, confirmar que las dos se ponen rojas y después blancas, y borrar la llamada de prueba.

No se tocan las luces de las mesas ni las automatizaciones. No se publica nada sin tu permiso. Para que la app publicada reciba estos arreglos, hay que publicarla.

## Detalles técnicos
- `useSession`: nuevo estado `rolesReady`, que pasa a verdadero cuando termina la consulta a `user_roles`. Si la consulta da error, se reintenta. `Protected` muestra el estado de carga mientras `adminOnly && !rolesReady`.
- `findLightsByName` (`tuya.server.ts`): compara el nombre normalizado (minúsculas, sin espacios de sobra) y acepta las categorías de luz `dj`, `dd`, `fwd`, `xdd` y `dc`.
- `relinkSharedLightByName`: une las luces encontradas con los IDs que ya estaban guardados y siguen en línea, en vez de reemplazar toda la lista.
