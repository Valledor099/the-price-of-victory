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
| Bloquear | Mantener espacio | Levantar ambos guantes cerca de la cara o mantener agarre |
| Pausar | P o botón Pausa | Salir de la sesión del visor |
| Reiniciar al terminar | Volver a jugar | Gatillo |

## Probar en VR

Abrí el enlace **HTTPS** en el navegador del visor o en un navegador con un visor conectado. **Entrar en VR** aparece si el navegador informa compatibilidad con `immersive-vr`. Aceptá el permiso del navegador. En el túnel podés usar el gatillo cuando empiecen a abrirse las puertas. El combate dura 38 segundos. Los aciertos y bloqueos responden a tus acciones, y el fallo del jurado lleva a todos los jugadores al mismo desenlace narrativo.

## Editar la experiencia

- **Modelos**. Abrí `blender/FairPlay.blend`. Las colecciones contienen el estadio, el oponente, el árbitro, un espectador, el guante y el cinturón. `blender/build.py` reconstruye la geometría y exporta los seis GLB a `assets/`. Para regenerarlos, abrí una sesión nueva con `blender --background --python blender/build.py`.
- **Recorrido y controles**. `src/game.js` contiene las seis etapas, los tiempos y los controles comunes. `src/world.js` carga las mallas y distribuye el público. `src/audio.js` sintetiza el ambiente, la percusión y la campana.
- **Archivo documental**. Cada ficha de `src/archive.js` tiene lugar, año, titular, texto, fuente, enlace e ilustración. Conservá la atribución, la fecha y el contexto de cada caso. Los pictogramas de `src/boards.js` son ilustraciones editoriales. El único testimonio citado se presenta en inglés junto a su traducción. La pantalla de cierre enlaza las investigaciones originales.
- **Identidad**. Logotipo del proyecto Fair Play, Playfair Display y Arial. La ilustración fotográfica de portada se generó para la experiencia.

## Publicar con GitHub Pages

Subí el contenido a la raíz de la rama `main`. En **Settings → Pages → Build and deployment** elegí **Deploy from a branch**, rama **main** y carpeta **/(root)**. Los cambios en esa rama actualizan el enlace público. El sitio usa rutas relativas para alojarse bajo el nombre del repositorio.

## Créditos

A-Frame se distribuye bajo la licencia incluida en `vendor/AFRAME-LICENSE.txt`. Playfair Display se distribuye bajo la licencia incluida en `assets/Playfair-OFL.txt`. Los créditos y enlaces de Amnistía Internacional y Human Rights Watch se conservan en las fichas documentales.
