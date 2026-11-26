# El precio de la victoria

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
| Jab | Clic izquierdo | Gesto hacia adelante con cualquiera de los mandos o gatillo izquierdo |
| Uppercut | Clic derecho | Gesto ascendente con cualquiera de los mandos o gatillo derecho |
| Esquivar | Salir de la trayectoria con WASD durante la preparación | Inclinarte, agacharte o dar un paso con el cuerpo cuando el rival carga el golpe |
| Bloquear | Mantener espacio | Levantar ambos guantes cerca de la cara o mantener agarre |
| Pausar | P o botón Pausa | Salir de la sesión del visor |
| Reiniciar al terminar | Volver a jugar | Gatillo |

## Probar en VR

Abrí el enlace **HTTPS** en el navegador del visor o en un navegador con un visor conectado. **Entrar en VR** aparece si el navegador informa compatibilidad con `immersive-vr`. Aceptá el permiso del navegador. La entrada incluye cinco indicaciones de seis segundos para practicar los controles. Cuando aparezca **Avanzá al ring**, usá el stick o el gatillo para entrar. En computadora, acercate con WASD. El combate dura 38 segundos. El rival apunta a la posición del visor al iniciar su preparación. Con seguimiento de posición podés esquivar con el cuerpo, también sentado. El contador muestra golpes, bloqueos y esquivas. Los aciertos y bloqueos responden a tus acciones, y el fallo del jurado lleva a todos los jugadores al mismo desenlace narrativo.

## Editar la experiencia

- **Modelos**. Abrí `blender/FairPlay.blend`. El archivo contiene el estadio, la tribuna, el rival, los guantes y el cinturón. La colección `Athletes / opponent` incluye las texturas, un esqueleto de 13 huesos y once animaciones de guardia, avance, retroceso, desplazamiento lateral, esquiva, golpes y reacciones. En Blender podés verlas en el editor de animación no lineal (NLA). `blender/humans.py` adapta el modelo de MakeHuman y `blender/footwork.py` anima su postura. `blender/belt.py` genera el cinturón. `blender/build.py` exporta los cinco GLB. Para regenerarlos, abrí una sesión nueva con `blender --background --python blender/build.py`.
- **Recorrido y controles**. `src/game.js` contiene las seis etapas, los tiempos y los controles comunes. `src/world.js` carga las mallas y `src/stands.js` distribuye las siluetas en veinte filas y dos bandejas. `src/audio.js` mezcla las grabaciones del estadio y la campana con el contacto de los guantes. Podés ajustar el volumen desde **Ver controles** o **Pausa**. La campana marca el inicio y el final del único round. Los aplausos acompañan todo el tramo desde la puerta hasta la campana y vuelven durante el festejo del cinturón. En el round se oyen las voces de la tribuna y se ven los flashes de las cámaras. Los marcadores muestran el tiempo del asalto. En la victoria el jugador levanta el cinturón con ambos guantes. La secuencia está en `src/ceremony.js`. Después de levantar el cinturón, la pregunta aparece centrada en la vista del jugador y coincide con el corte del público. Después de la pregunta y una pausa entra *Después de la campana*, una composición original de piano y cuerdas graves. El encendido de las pantallas se escucha al comenzar las noticias. Las noticias cambian cada 8,5 segundos. Con los focos apagados, los cuatro televisores proyectan luz sobre el ring y toman su tonalidad de la imagen que muestran.
- **Archivo documental**. Cada ficha de `src/archive.js` tiene lugar, año, titular, texto, fuente, enlace e ilustración. Conservá la atribución, la fecha y el contexto de cada caso. Las cuatro escenas en `assets/archive.webp` son ilustraciones editoriales generadas para el juego. En el estadio se muestra la frase breve y en el cierre se puede leer el contexto completo. El cierre conserva el testimonio en inglés junto a su traducción. La pantalla de cierre enlaza las investigaciones originales.
- **Identidad**. Logotipo del proyecto Fair Play, Playfair Display y Arial. La ilustración fotográfica de portada se generó para la experiencia.

## Publicar con GitHub Pages

Subí el contenido a la raíz de la rama `main`. En **Settings → Pages → Build and deployment** elegí **Deploy from a branch**, rama **main** y carpeta **/(root)**. Los cambios en esa rama actualizan el enlace público. El sitio usa rutas relativas para alojarse bajo el nombre del repositorio.

## Créditos

El rival es una adaptación de la malla HM08 de MakeHuman. Se usaron los rasgos de edad, musculatura y rostro, las ponderaciones del esqueleto y los ojos del proyecto. Las texturas de piel y ojos proceden de los recursos de sistema. La guardia y los pasos están animados en Blender. [Malla original](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs/base.obj) · [Recursos de sistema](https://download.tuxfamily.org/makehuman/assets/1.1/base/) · [Licencia CC0 de MakeHuman](https://www.makehumancommunity.org/about/license.html).

El murmullo de voces usa **R08-10-Large Crowd Murmur**, digitalizado por craigsmith. El murmullo y los aplausos se cortan al vaciarse el estadio. [Grabación original](https://freesound.org/people/craigsmith/sounds/480723/) · [Licencia CC0](https://creativecommons.org/publicdomain/zero/1.0/).

A-Frame se distribuye bajo la licencia incluida en `vendor/AFRAME-LICENSE.txt`. Playfair Display se distribuye bajo la licencia incluida en `assets/Playfair-OFL.txt`. La campana usa la grabación **Boxing Bell 1.wav**, de Benboncan, con ajuste de nivel y recorte del silencio inicial. [Grabación original](https://freesound.org/people/Benboncan/sounds/66952/) · [Licencia CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Los aplausos de entrada y de victoria usan **Applause 2.WAV**, grabado por Sandermotions en la sala de conciertos De Doelen. [Grabación original](https://freesound.org/people/Sandermotions/sounds/277021/) · [Licencia CC0](https://creativecommons.org/publicdomain/zero/1.0/).

El encendido de los televisores usa un fragmento de **CRT TV Switches On**, de Fission9, con recorte y filtrado del silbido agudo. [Grabación original](https://freesound.org/people/Fission9/sounds/693860/) · [Licencia CC0](https://creativecommons.org/publicdomain/zero/1.0/).

Los créditos y enlaces de Amnistía Internacional y Human Rights Watch se conservan en las fichas documentales.
