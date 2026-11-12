# Laboratorio virtual de manipulación y ensamblaje 3D

Aplicación web estática para Meta Quest 3. En una sesión WebXR `immersive-vr`, el alumno identifica cinco formas, las toma con una pinza, las ensambla en sus receptáculos y recibe confirmación visual, sonora y de progreso.

## Estado de entrega

- Proyecto y documentación preparados para Live Server y GitHub Pages.
- **No publicado ni probado en Meta Quest 3 desde este entorno.** La matriz de aceptación permanece pendiente hasta contar con resultados y evidencias reales.
- La vista de computadora es una previsualización orientativa; no simula ni sustituye la sesión inmersiva.

## Requisitos

- Visual Studio Code con la extensión **Live Server**.
- Git y una cuenta de GitHub para la publicación.
- Meta Quest 3 con Meta Quest Browser y seguimiento de manos habilitado.
- Conexión a Internet para los CDN.
- Un contexto seguro: HTTPS en producción o localhost en desarrollo. La sesión debe iniciarse mediante el botón de entrada y con la página activa.

No se requiere Node.js, npm, bundler, backend ni proceso de compilación.

## Ejecutar en Live Server

1. Abre esta carpeta en Visual Studio Code.
2. Abre `index.html` y elige **Open with Live Server**.
3. En computadora, revisa la portada y la previsualización. La PC no recibe automáticamente el seguimiento del visor.
4. Para probar manos, abre la URL HTTPS publicada directamente en Meta Quest Browser. `localhost` en la computadora no es `localhost` dentro del visor.

La sesión requiere `immersive-vr` y solicita `hand-tracking` como función obligatoria; `local-floor` se solicita como opcional. Si el navegador no expone entrada de manos, la sesión no debe presentarse como una prueba completada.

## Interacción y reglas

- El panel 3D muestra progreso, tiempo, detección de manos, estado, instrucciones, **RESET LAB** y **EXIT VR**.
- Apunta con el rayo de una mano y junta índice y pulgar para tomar una pieza. El umbral de inicio de pinza es 2.3 cm; se suelta a 4.2 cm para reducir oscilaciones.
- Suelta la pieza a un máximo de **0.13 m** del centro de su receptáculo correcto. La distancia es euclidiana entre el centro de la pieza y el centro objetivo en unidades del mundo Three.js (1 unidad se trata como 1 metro).
- La comprobación ocurre solo al soltar. Un destino equivocado o una distancia excesiva muestra error temporal, tono discreto y la pieza soltada parpadea en rojo. Si corresponde, también se marca en rojo el receptáculo libre más cercano; los receptáculos ya completados permanecen verdes. El error no suma progreso ni bloquea la pieza.
- Un acierto ajusta posición y orientación, marca pieza y destino, bloquea la pieza, produce un tono breve y aumenta el progreso. El contador se calcula a partir de los estados `placed`; no se mantiene una segunda copia del conteo.
- Al completar las cinco parejas, el cronómetro se detiene. **RESET LAB** restablece piezas, destinos, tiempo y progreso, incluso después de completar. Al salir y volver a entrar, el avance y el tiempo se conservan; el cronómetro queda pausado fuera de VR.
- Si se pierde el tracking mientras una pieza está tomada, se libera en su última posición sin validar el ensamblaje.

La tolerancia y límites de movimiento se pueden ajustar en `src/state/labState.js`.

## Import map y CDN

El import map está dentro de `<head>` en `index.html`, antes del módulo de entrada. El navegador no resuelve por sí solo el nombre desnudo `three`; el mapa asocia `three` con el archivo del núcleo y `three/addons/` con los addons. Núcleo y addons usan **Three.js 0.187.0** desde jsDelivr para mantener una sola versión y proveedor. Bootstrap **5.3.9** se carga por CDN solo para la portada web; no aparece dentro del espacio VR. La hoja de estilos usa SRI para comprobar su contenido.

Las importaciones de la aplicación son ES modules locales con rutas relativas (`./src/...`, `../...`). Los recursos locales del HTML también usan rutas relativas para que funcionen bajo el subdirectorio de GitHub Pages. El laboratorio crea sus mallas y texturas Canvas en el navegador, sin descargar modelos ni sonidos.

## Arquitectura

| Ruta | Responsabilidad |
|---|---|
| `index.html` | Portada semántica, contenido Bootstrap, mensajes de compatibilidad, import map y entrada modular. |
| `assets/css/site.css` | Diseño responsive, foco de teclado y estados de carga. |
| `assets/icons/favicon.svg` | Icono vectorial local. |
| `src/main.js` | Inicialización, ciclo de renderizado, coordinación de sesión y estados de carga. |
| `src/state/labState.js` | Estado central, progreso derivado, cronómetro, tolerancias y mensajes. |
| `src/scene/labScene.js` | Sala, mesa, cinco piezas y cinco receptáculos, todos con geometrías creadas en código. |
| `src/xr/session.js` | Compatibilidad, botón de entrada y ciclo de sesión WebXR. |
| `src/xr/handTracking.js` | Articulaciones XR reales, rayos, pinza con histéresis y visualización ligera de manos. |
| `src/interaction/interactionController.js` | Prioridad de controles, selección exclusiva, arrastre, liberación y reinicio. |
| `src/lab/assemblyRules.js` | Validación de identidad del destino y tolerancia. |
| `src/ui/vrPanel.js` | Panel CanvasTexture y botones tridimensionales dentro de VR. |
| `src/ui/canvasUi.js` | Texturas de etiquetas y HUD dibujadas en canvas. |
| `src/audio/feedback.js` | Tonos Web Audio generados localmente. |

El antiguo ejemplo de física se conserva en `examples/hand-physics-demo.html`. Los directorios `build/` y `jsm/` pertenecen al ejemplo Three.js inicial y no se cargan desde esta portada; el laboratorio resuelve Three.js y sus addons por el import map CDN.

El rayo de mano usa `targetRaySpace` cuando el navegador lo ofrece, con una dirección derivada del dedo índice como respaldo. Las manos se dibujan con puntos articulares instanciados y líneas; esto mantiene el número de llamadas de dibujo bajo y evita depender de modelos remotos. Las entradas que no contienen `XRInputSource.hand` se ignoran: no se usa un mando como sustituto.

## Publicar en GitHub Pages

1. Sube los archivos estáticos a un repositorio público en GitHub y usa la rama `main`.
2. En **Settings → Pages → Build and deployment**, selecciona **Deploy from a branch**.
3. Elige `main` y `/(root)`, guarda los cambios y espera a que termine la publicación.
4. Abre la URL HTTPS mostrada por Pages y comprueba portada, favicon, imports y recursos.
5. Abre esa URL pública en Meta Quest Browser. No uses la URL `localhost` de la PC para las pruebas del visor.

Para investigar 404, errores CORS o imports fallidos, abre DevTools en computadora y revisa **Console** y **Network**: confirma que `index.html`, CSS, `src/main.js`, los módulos relativos y las URLs CDN devuelven respuesta. En Pages, confirma que las rutas locales mantienen `./` o `../` y no comienzan con `/`.

## Pruebas de aceptación

`Pendiente` significa que no existe una observación real todavía. No se da por aprobada ninguna prueba de visor o despliegue sin evidencia.

| Requisito | Cómo probar | Resultado esperado | Resultado observado | Evidencia |
|---|---|---|---|---|
| Portada responsive, favicon y créditos | Abrir en escritorio y reducir el ancho | Diseño legible; icono, requisitos y créditos visibles | Pendiente | Pendiente |
| Live Server | Abrir la URL servida y revisar Console/Network | Módulos y estilos cargan sin errores | Pendiente | Pendiente |
| Import map y versiones | Inspeccionar `index.html`, Network y consola | Three.js 0.187.0 y addons del mismo jsDelivr | Pendiente | Pendiente |
| Rutas relativas | Servir desde una carpeta y desde subdirectorio Pages | Recursos locales sin 404 | Pendiente | Pendiente |
| Publicación `main/(root)` | Abrir URL pública sin iniciar sesión | Página HTTPS publicada desde la rama | Pendiente | Pendiente |
| Sesión immersive-vr y salida | Entrar desde Meta Quest Browser y usar EXIT VR | VR estereoscópica real y salida segura | Pendiente | Pendiente |
| Seguimiento izquierda y derecha | Mostrar cada mano y luego ambas | HUD distingue mano izquierda/derecha; sin mando físico | Pendiente | Pendiente |
| Rayo, resalte, pinza, arrastre y suelta | Apuntar y mover una pieza | Selección estable y una sola mano controla la pieza | Pendiente | Pendiente |
| Cinco piezas y cinco destinos | Contarlos en la mesa | Cinco formas e identidades únicas | Pendiente | Pendiente |
| Error de destino | Soltar una pieza cerca del receptáculo libre de otra | Pieza y receptáculo libre en rojo; mensaje; progreso no aumenta | Pendiente | Pendiente |
| Error de distancia | Soltar lejos del receptáculo correcto | Mensaje de distancia; progreso no aumenta | Pendiente | Pendiente |
| Cinco aciertos | Ensamblar las parejas correctas | Snap, verde, sonido, bloqueo y progreso 0/5→5/5 | Pendiente | Pendiente |
| Cronómetro y finalización | Completar el reto | El tiempo avanza, se detiene y aparece al finalizar | Pendiente | Pendiente |
| Reinicio activo y completo | Reiniciar durante el reto y después de 5/5 | Posiciones, materiales, tiempo y progreso vuelven al inicio | Pendiente | Pendiente |
| Salir y volver a entrar | Cerrar desde el panel y volver a entrar | Sin selección pendiente; avance conservado y timer pausado fuera | Pendiente | Pendiente |
| Panel y botones dentro de VR | Leer HUD y pellizcar RESET/EXIT dentro del visor | Información 3D legible y controles funcionales | Pendiente | Pendiente |
| Modularidad, assets y licencias | Revisar archivos, imports y créditos | Rutas relativas, sin secretos ni assets externos no acreditados | Pendiente | Pendiente |

La portada, los imports y la estructura se pueden revisar en escritorio. La interacción real, las articulaciones de ambas manos, la comodidad, la legibilidad del HUD y el rendimiento deben validarse físicamente en Meta Quest 3. No se reportan métricas de FPS porque no se han medido en el dispositivo.

## Evidencias y reflexión

La carpeta `3.1 Introducción a las aplicaciones VR/` contiene una lista para capturas, video, notas y enlaces. Antes de entregar, agrega evidencia de portada, escena, ambos lados de tracking, un error por destino, un error por distancia, los cinco aciertos, reinicio, salida y rendimiento observado.

Dos correcciones de ingeniería realizadas con asistencia del agente:

1. El menú anterior se posicionaba con coordenadas locales de cámara, que podían dejarlo fuera de vista en XR. El panel actual se ancla con posición/dirección mundiales y recalibra al iniciar cada sesión.
2. El progreso podía desincronizarse si se actualizaba por separado. En este laboratorio se deriva de las piezas con estado `placed`, y solo cambia tras validar una liberación correcta.

Estas son correcciones de implementación; su respuesta real en el visor sigue pendiente de comprobación. Completa las conclusiones con lo aprendido sobre Three.js, WebXR, pinza, raycasting e import maps, y describe dos problemas que hayas observado durante tus propias pruebas.

## Créditos y licencias

La actividad toma como referencia conceptual el rayo, la pinza y el arrastre de la demostración oficial [Three.js WebXR hand input pointer drag](https://threejs.org/examples/webxr_vr_handinput_pointerdrag.html); su diseño visual y estructura no se reutilizan como solución. Three.js y Bootstrap son proyectos MIT; sus dependencias permanecen en sus CDN oficiales/jsDelivr. La geometría, el favicon y las texturas del laboratorio se generan o definen en este proyecto; no se distribuyen modelos, imágenes ni sonidos de terceros. Crédito de entrega: **Student project**; añade tu nombre antes de publicar.

## Datos de entrega por completar

- Repositorio público de GitHub: pendiente.
- URL HTTPS de GitHub Pages: pendiente.
- Video del ensamblaje real en Meta Quest 3: pendiente.
- Conclusiones del alumno: pendiente.
