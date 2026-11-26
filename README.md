# The Price of Victory

Una experiencia de boxeo en primera persona de **Fair Play** sobre el sportswashing. Una final ficticia da paso a un archivo documental sobre Qatar y Sochi. El recorrido dura aproximadamente dos minutos y medio.

**[Jugar en el navegador](https://valledor099.github.io/the-price-of-victory/)**

## Probar en computadora

Desde la carpeta que contiene `index.html`, iniciá un servidor estático con Python 3.

```sh
python -m http.server 8000
```

Abrí [localhost en el puerto 8000](http://localhost:8000) y elegí **Entrar al ring**. El navegador necesita WebGL 2. El motor A-Frame 1.7.1, los modelos, la portada y las tipografías se sirven desde el proyecto.

| Acción | Computadora | Visor con WebXR |
| --- | --- | --- |
| Mirar | Mouse. Si está libre, hacé clic en el ring | Girar la cabeza |
| Moverte | WASD | Stick izquierdo |
| Girar por pasos | — | Stick derecho |
| Golpear | Clic izquierdo, mirando al rival desde cerca | Acercar un guante al rival con movimiento o pulsar el gatillo a corta distancia |
| Esquivar | Salir de la trayectoria con WASD durante la preparación | Inclinarte, agacharte o dar un paso con el cuerpo cuando el rival carga el golpe |
| Bloquear | Mantener espacio | Levantar ambos guantes cerca de la cara o mantener agarre |
| Pausar | P o botón Pausa | Salir de la sesión del visor |
| Reiniciar al terminar | Volver a jugar | Gatillo |

## Probar en VR

Abrí el enlace **HTTPS** en el navegador del visor o en un navegador con un visor conectado. **Entrar en VR** aparece si el navegador informa compatibilidad con `immersive-vr`. Aceptá el permiso del navegador. La entrada incluye cinco indicaciones de seis segundos para practicar los controles. Cuando aparezca **Avanzá al ring**, usá el stick o el gatillo para entrar. En computadora, acercate con WASD. El combate dura 38 segundos. El rival apunta a la posición del visor al iniciar su preparación. Con seguimiento de posición podés esquivar con el cuerpo, también sentado. El contador muestra golpes, bloqueos y esquivas. Los aciertos y bloqueos responden a tus acciones, y el fallo del jurado lleva a todos los jugadores al mismo desenlace narrativo.

## Editar la experiencia

- **Modelos**. Abrí `blender/FairPlay.blend`. Las colecciones contienen el estadio, el oponente, el árbitro, un espectador, el guante y el cinturón. Los personajes tienen armaduras, ojos y piel con textura empaquetados en las colecciones `Athletes / opponent` y `Athletes / referee`. `blender/humans.py` contiene la adaptación anatómica y de vestuario. `blender/belt.py` modela la correa, las placas y el monograma en relieve del cinturón. `blender/build.py` reutiliza esos personajes editables, reconstruye el estadio y exporta los seis GLB a `assets/`. Para regenerarlos, abrí una sesión nueva con `blender --background --python blender/build.py`.
- **Recorrido y controles**. `src/game.js` contiene las seis etapas, los tiempos y los controles comunes. `src/world.js` carga las mallas y `src/stands.js` distribuye las siluetas en veinte filas y dos bandejas. `src/audio.js` mezcla las grabaciones del estadio y la campana con el contacto de los guantes. Podés ajustar el volumen desde **Ver controles** o **Pausa**. La campana marca el inicio y el final del único round. Después de levantar el cinturón, la pregunta aparece centrada en la vista del jugador y coincide con el corte del público. Las pantallas se encienden después del silencio.
- **Archivo documental**. Cada ficha de `src/archive.js` tiene lugar, año, titular, texto, fuente, enlace e ilustración. Conservá la atribución, la fecha y el contexto de cada caso. Las cuatro escenas en `assets/archive.webp` son ilustraciones editoriales generadas para el juego. En el estadio se muestra la frase breve y en el cierre se puede leer el contexto completo. El cierre conserva el testimonio en inglés junto a su traducción. La pantalla de cierre enlaza las investigaciones originales.
- **Identidad**. Logotipo del proyecto Fair Play, Playfair Display y Arial. La ilustración fotográfica de portada se generó para la experiencia.

## Publicar con GitHub Pages

Subí el contenido a la raíz de la rama `main`. En **Settings → Pages → Build and deployment** elegí **Deploy from a branch**, rama **main** y carpeta **/(root)**. Los cambios en esa rama actualizan el enlace público. El sitio usa rutas relativas para alojarse bajo el nombre del repositorio.

## Créditos

El rival y el árbitro son adaptaciones de la malla HM08 de MakeHuman. Se usaron los rasgos de edad, musculatura y rostro, las ponderaciones del esqueleto y los ojos del proyecto. Las texturas de piel, pelo corto, ropa y zapatos proceden de los recursos de sistema. Los personajes se posaron y se prepararon en Blender para el ring. [Malla original](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs/base.obj) · [Recursos de sistema](https://download.tuxfamily.org/makehuman/assets/1.1/base/) · [Licencia CC0 de MakeHuman](https://www.makehumancommunity.org/about/license.html).

El murmullo de voces usa **R08-10-Large Crowd Murmur**, digitalizado por craigsmith. Se mezcla con la ovación y comparte el corte de audio al vaciarse el estadio. [Grabación original](https://freesound.org/people/craigsmith/sounds/480723/) · [Licencia CC0](https://creativecommons.org/publicdomain/zero/1.0/).

A-Frame se distribuye bajo la licencia incluida en `vendor/AFRAME-LICENSE.txt`. Playfair Display se distribuye bajo la licencia incluida en `assets/Playfair-OFL.txt`. La campana usa la grabación **Boxing Bell 1.wav**, de Benboncan, con ajuste de nivel y recorte del silencio inicial. [Grabación original](https://freesound.org/people/Benboncan/sounds/66952/) · [Licencia CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

El ambiente usa **MLB Crowd Cheer - 09032022.wav**, de tylermyers1992, filtrado y reproducido en bucle. [Grabación original](https://freesound.org/people/tylermyers1992/sounds/649156/) · [Licencia CC0](https://creativecommons.org/publicdomain/zero/1.0/).

Los créditos y enlaces de Amnistía Internacional y Human Rights Watch se conservan en las fichas documentales.
