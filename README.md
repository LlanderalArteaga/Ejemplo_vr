# Ejemplo WebXR: seguimiento de manos

Demo de realidad virtual en el navegador con Three.js. Permite apuntar, seleccionar y arrastrar objetos usando las manos.

## Publicar en GitHub Pages

1. Sube este repositorio a GitHub.
2. En el repositorio, abre **Settings → Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Elige la rama que contiene el proyecto y la carpeta **/(root)**; guarda los cambios.
5. Abre la URL que GitHub Pages indique. La página de inicio es `index.html`.

## Probar la demo

Abre la página desde un navegador y un dispositivo compatibles con WebXR y seguimiento de manos. La demo solicita la función `hand-tracking` al iniciar la sesión de realidad virtual. GitHub Pages sirve el sitio por HTTPS, necesario para las funciones WebXR en navegadores compatibles.

## Archivos principales

- `index.html`: escena y lógica de la demo.
- `examples/main.css`: estilos de la página.
- `build/three.module.js`: módulo de Three.js incluido en el proyecto.
- `jsm/webxr/`: módulos WebXR relacionados con manos, puntero, texto y controles.

La página carga Three.js y los módulos `three/addons/` desde un CDN definido en el import map de `index.html`; por eso se requiere conexión a Internet al abrir la demo.
