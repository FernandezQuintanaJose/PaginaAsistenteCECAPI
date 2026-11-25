# Entrega del asistente web (4 nov 2026)

**Qué hace cada quien esta semana: [TAREAS.md](TAREAS.md).**

Revisión completa, hallazgos de todo el ecosistema y orden sugerido para la semana: [docs/estado/2026-11-04-revision-qa-y-entrega.md](https://github.com/FernandezQuintanaJose/EstadiasAppMobil/blob/docs/revision-qa-4nov/docs/estado/2026-11-04-revision-qa-y-entrega.md) en EstadiasAppMobil (rama `docs/revision-qa-4nov`).

## Estado
- `revisar` 88, `flujo` 32, `cuenta` 48, `descargas` 7 y `hostil` 28 pasan.
- Corregido: el chat ya no se bloquea si el servidor responde 200 sin una respuesta de texto; las líneas de contexto respetan el límite de 1000 del servidor; las descargas solo aceptan Releases de `EstadiasAppMobil` y `WindowsCECAPI` del dueño del proyecto.
- Los archivos `api`, `asistente` y `descargas` subieron de versión (`api.v4.js`, `asistente.v4.js`, `descargas.v3.js`).
- Se agregó `package-lock.json` para que todos usen la misma versión de Playwright.

## No puede preguntar todavía (depende del servidor)
- Falta CORS para `https://fernandezquintanajose.github.io` y el dominio final.
- `/preguntar` pide `X-Clave-App`, que una página pública no puede llevar (README, "Estado frente al servidor real").
- Faltan las rutas de cuenta.

## Para entregar
1. ~~Fusionar `qa/correcciones` a `main`~~ (hecho el 4 nov 2026).
2. Cuando el servidor esté publicado: `apiBase` en `assets/js/config.v2.js` y, si no es `*.onrender.com`, `connect-src` de la CSP de `index.html`.
3. Llenar `config.rutas` con las rutas de cuenta y decidir `permitirSinCuenta`.
4. `politicas.html`: datos entre corchetes, correo ARCO que confirme CECAPI y revisión legal.
5. `datos/descargas.v1.json`: cuando existan los Releases de Android y Windows (versión, archivo, url, tamaño y SHA-256).
6. Probar con NVDA, Narrator y TalkBack.
7. Publicar en Pages (rama `main`). Con dominio propio, `<base href>` de `404.html` a `/`.
8. Si cambias un `.css` o `.js`, súbele la versión al nombre y actualiza los enlaces.

## Cómo repetir las pruebas
`npm install`, `npx playwright install chromium` y luego `npm run revisar|flujo|cuenta|descargas|hostil`.
