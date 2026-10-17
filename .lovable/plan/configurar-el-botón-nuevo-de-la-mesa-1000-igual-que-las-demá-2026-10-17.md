# Configurar el botón nuevo de la mesa 1000 igual que las demás mesas

## Qué va a hacer el botón de la mesa 1000
- **Botón 1, un clic:** apagar / prender las luces de la mesa 1000
- **Botón 1, doble clic:** efecto HAPPY (escena 30 segundos y vuelve a blanco)
- **Botón 3:** llamar al mesero (pantalla + luces SERVER en rojo)
- **Botón 4:** terminar la llamada (luces SERVER vuelven a blanco)

## Pasos
1. Buscar en Tuya el botón nuevo de la mesa 1000 por su nombre (ej. "1000 button") y el grupo de luces de la mesa 1000. Si no aparecen, te aviso qué nombre tienen que tener en Smart Life; no invento ningún código.
2. Guardar ese botón en la mesa 1000 de la app, con llamar = 3 y atender = 4 (un clic), igual que las otras mesas. También guardar el grupo de luces de la 1000, así entra en "Encender / Apagar todas" y "SHOW en todas".
3. Copiar las automatizaciones de Smart Life de la mesa 900 hacia la mesa 1000:
   - la de un clic en el botón 1 (apagar/prender)
   - la de doble clic en el botón 1 (HAPPY)
   cambiando solo el botón y las luces por los de la mesa 1000. Si la 900 no tiene la de un clic, te aviso antes de crear algo nuevo.
4. Probar: una llamada de prueba en la mesa 1000 desde la app (aparece en pantalla y se pone roja la luz SERVER), atenderla, y revisar que las automatizaciones queden activas.

## Lo que no se toca
Las otras mesas, sus automatizaciones, las luces SERVER y la lógica de llamadas. No se publica.

## Aviso
El cupo de Tuya está lleno: es posible que la app no pueda manejar las luces de la 1000 hasta ampliarlo. Las automatizaciones de Smart Life y las llamadas sí funcionan igual.
