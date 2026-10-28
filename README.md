# Asistente web de CECAPI

Página para conversar por escrito con el asistente de IA de CECAPI, pensada para personas ciegas y con baja visión, más el panel de descargas de las apps de Android y Windows.

La ficha del proyecto está en `docs/FICHA.md` y las reglas comunes en `docs/FICHA_GLOBAL.md`.

## Qué hay

| Archivo | Qué es |
|---|---|
| `index.html` | Asistente: políticas por partes, cuenta y chat |
| `politicas.html` | Políticas de uso y privacidad (borrador). Es la única fuente del texto: `index.html` lo lee de aquí |
| `descargas.html` | Descargas con versión, tamaño y SHA-256, leídas de `datos/descargas.v1.json` |
| `404.html` | Usa `<base href="/PaginaAsistenteCECAPI/">`; con dominio propio, cambiar a `/` |
| `assets/js/config.v1.js` | Servidor, ID de cliente de Google y rutas. Público: sin llaves |
| `assets/js/api.v1.js` | Cliente del servidor con tiempo de espera y errores en español |
| `assets/js/asistente.v1.js` | Lógica de la página |
| `assets/css/`, `assets/fuentes/`, `preferencias.v3.js`, `lectura.v1.js` | Igual que en PaginaCECAPI |

## Cómo funciona

- **Políticas:** se leen por partes (Repetir, Siguiente, Escuchar en voz alta). Para aceptar hay que llegar a la última parte y marcar la declaración de 18 años o más. "Rechazar" y "Después" dejan el asistente en pausa. La aceptación se guarda en el navegador con la versión (`data-version` de `politicas.html`) y, cuando el servidor tenga la ruta, también en el servidor. Cambiar `data-version` obliga a aceptar de nuevo.
- **Chat:** manda `{ pregunta, contexto }` a `POST /preguntar` con las últimas 6 líneas de la conversación. La respuesta se anuncia al lector de pantalla con una región `aria-live` educada y, si la persona lo pide, se lee con la voz del navegador. Enter envía; Mayúsculas + Enter hace salto de línea.
- **Servidor dormido:** al abrir la página se llama a `GET /` para despertarlo. Si una respuesta tarda más de 4 segundos, se avisa que el servidor está despertando y suena un tono suave cada 3 segundos (se puede apagar).
- **Sesión:** el token vive solo en memoria. Cerrar sesión borra el token y la conversación. Las preferencias de texto, contraste y voz se quedan porque no son datos personales.

## Lo que falta y de quién depende

| Pendiente | Quién |
|---|---|
| `apiBase` en `config.v1.js` (URL de Render) y el mismo origen en `connect-src` de la CSP si no es `*.onrender.com` | Móvil A, al desplegar |
| CORS en el servidor para el origen de GitHub Pages (`https://fernandezquintanajose.github.io`) y el dominio final. Sin esto el navegador bloquea las preguntas | Móvil A (ficha backend, tarea 6) |
| Ruta de sesión: `POST` con `{ idToken }` que verifique con `id_token.verify_oauth2_token` y devuelva `{ token, nombre }`. Poner la ruta en `config.rutas.sesion` | Móvil A (tarea 4) |
| Ruta de aceptación: `POST` con `{ version, fecha, mayorDeEdad }` y `Authorization: Bearer`. Poner la ruta en `config.rutas.aceptacion` | Móvil A (tarea 3) |
| `googleClientId` (Google Auth Platform, tipo aplicación web, con los orígenes de la página) | Titular de la cuenta |
| Decidir si se permite usar sin cuenta (`permitirSinCuenta`) | CECAPI y equipo |
| Datos entre corchetes de `politicas.html` y revisión legal | CECAPI y asesor |
| Llenar `datos/descargas.v1.json` en cada versión publicada | Equipos de Android y Windows |

La forma de las rutas de sesión y aceptación es una propuesta; si el servidor usa otra, ajustar `api.v1.js`.

## Publicar una versión de app

En `datos/descargas.v1.json`, en la app que corresponda, llenar `version`, `archivo`, `url` (enlace https del archivo en GitHub Releases), `tamanoBytes` y `sha256`. Para sacar la suma: `sha256sum archivo` en Linux o `Get-FileHash archivo -Algorithm SHA256` en PowerShell. Mientras `url` esté en `null`, la página dice que no hay versión publicada.

## Probar en local

```
npm install
npx playwright install chromium   # solo la primera vez
npm run servir    # http://localhost:8080/PaginaAsistenteCECAPI/
npm run revisar   # axe (WCAG 2.2 AA), consola, recursos y ancho de 375 px en claro, oscuro y contraste alto
npm run flujo     # flujo completo con un servidor de IA simulado
```

Para usar el servidor real en local, poner su URL en `apiBase` y agregarla a `connect-src` de la CSP solo en tu copia; no subir `localhost` a la CSP.

Antes de publicar: probar con NVDA, JAWS (si hay acceso) y Narrator, y pasar la auditoría OWASP Top 10:2025 (CSP, CORS, almacenamiento del token).

## Seguridad

- Ninguna llave en el JavaScript: cualquier persona puede leerlo.
- CSP en `<meta>`: solo scripts propios y el de Google Identity; conexiones solo al servidor y a Google.
- Todo lo que llega del servidor se inserta como texto (`textContent`), nunca como HTML.
- Peticiones con `cache: "no-store"` y sin cookies.
