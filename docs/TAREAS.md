# Tareas del equipo — Asistente web

Semana del 4 al 11 nov 2026. Lo que no se pudo comprobar se marca **SIN VERIFICAR**: no se inventa.

## Cómo empezar (15 min)

```
git clone https://github.com/FernandezQuintanaJose/PaginaAsistenteCECAPI.git
cd PaginaAsistenteCECAPI
git checkout qa/correcciones                # hasta que se fusione a main
npm install
npx playwright install chromium
npm run revisar && npm run flujo && npm run cuenta && npm run descargas && npm run hostil
```

Reglas de trabajo:
- Una rama por tarea: `tarea/<nombre-corto>`. Pull request a `main`.
- Si cambias un `.css` o `.js`, súbele la versión al nombre y actualiza los enlaces en todas las páginas.
- No guardar preguntas ni respuestas del público en el navegador ni en el repositorio.
- Las descargas solo aceptan Releases de `EstadiasAppMobil` y `WindowsCECAPI` del dueño del proyecto: no ampliar esa lista sin avisar.

## Prioridad 1 — Sin esto no se puede entregar

| # | Tarea | Dónde | Hecho cuando |
|---|---|---|---|
| A1 | **Servidor publicado**: poner `apiBase` en `assets/js/config.v2.js` y, si no es `*.onrender.com`, el `connect-src` de la CSP de `index.html`. | `config.v2.js`, `index.html` | El chat responde contra el servidor real desde la URL de Pages. |
| A2 | **CORS y clave**: el servidor debe permitir `https://fernandezquintanajose.github.io` (y el dominio final), y `/preguntar` hoy pide `X-Clave-App`, que una página pública no puede llevar. Acordar con el equipo del servidor una solución (por ejemplo, una ruta pública con límite por IP). **No** poner la clave en el JavaScript: cualquiera la lee. | Servidor + `api.v4.js` | Decisión escrita y probada. Hasta entonces la página dice que aún no puede preguntar. |
| A3 | **Rutas de cuenta**: llenar `config.rutas` cuando existan y decidir `permitirSinCuenta`. | `config.v2.js` | `npm run cuenta` pasa contra rutas reales o su simulación actualizada. |
| A4 | **Políticas**: datos entre corchetes, correo ARCO confirmado por CECAPI y revisión legal. | `politicas.html` | Sin corchetes. Revisión legal por escrito. |
| A5 | **Descargas**: cuando existan los Releases de Android y Windows, registrar versión, archivo, url, tamaño y SHA-256. | `datos/descargas.v1.json` | La página muestra los botones; `npm run descargas` pasa. |
| A6 | **Fusionar** `qa/correcciones` a `main` y publicar en Pages. | GitHub | Abre en su URL. |

## Prioridad 2 — Calidad

| # | Tarea | Hecho cuando |
|---|---|---|
| B1 | **Lectores de pantalla**: NVDA, Narrator y TalkBack. Recorrer chat, políticas, descargas y mensajes de error. Anotar en `docs/LECTORES.md` (crearlo). Las pruebas automáticas no sustituyen esto. | Lista de hallazgos con navegador y versión; corregidos los que impiden usar el chat. |
| B2 | **Servidor dormido**: el plan gratuito tarda cerca de un minuto en despertar. Comprobar que el aviso hablado y el indicador de espera funcionan con el servidor real. | Probado con el servidor dormido. |
| B3 | **Pruebas hostiles nuevas**: pegar texto enorme, HTML, emojis, enviar con el servidor caído, cerrar la pestaña a mitad de respuesta. Añadirlas a `pruebas/hostil.mjs`. | Cada caso nuevo tiene su prueba y pasa. |
| B4 | **Navegadores**: Firefox, Safari de iPhone y Edge. **SIN VERIFICAR** hoy (las pruebas usan Chromium). | Lista de lo que falla. |

## Conectar con los demás equipos

- **Servidor** (EstadiasAppMobil, `backend/`): A1 y A2 dependen de su publicación. Hallazgos abiertos en `docs/estado/2026-11-04-revision-qa-y-entrega.md` de ese repositorio.
- **Windows y Android**: A5 espera sus Releases.
- **Sitio CECAPI**: solo enlaza a esta página.

## Entregable final

Página publicada, las cinco pruebas sin fallas, `docs/ENTREGA.md` al día, `docs/LECTORES.md`, lista de lo pendiente y por qué.
