# Asistente web de CECAPI

Página para conversar por escrito con el asistente de IA de CECAPI, pensada para personas ciegas y con baja visión, más el panel de descargas de las apps de Android y Windows.

La ficha del proyecto está en `docs/FICHA.md`, las reglas comunes en `docs/FICHA_GLOBAL.md` (sección 0, decisiones vigentes), la lista de verificación contra el código en `docs/INFORME_VERIFICACION.md` y los casos de prueba para el capítulo IV en `docs/CASOS_DE_PRUEBA.md`.

## Qué hay

| Archivo | Qué es |
|---|---|
| `index.html` | Asistente: políticas por partes, cuenta y chat |
| `politicas.html` | Políticas de uso y privacidad (borrador). Es la única fuente del texto: `index.html` lo lee de aquí |
| `descargas.html` | Descargas con versión, tamaño y SHA-256, leídas de `datos/descargas.v1.json`. Solo enlaces a GitHub Releases |
| `404.html` | Usa `<base href="/PaginaAsistenteCECAPI/">`; con dominio propio, cambiar a `/` |
| `assets/js/config.v2.js` | Servidor, rutas y reglas de cuenta. Público: sin llaves |
| `assets/js/api.v2.js` | Cliente del servidor con tiempo de espera y errores en español |
| `assets/js/asistente.v2.js` | Lógica de la página: políticas, cuenta, chat |
| `assets/css/`, `assets/fuentes/`, `preferencias.v4.js`, `lectura.v2.js` | Igual que en PaginaCECAPI (estilos del asistente en `asistente.v5.css`) |

## Cómo funciona

- **Políticas:** se leen por partes (Repetir, Siguiente, Escuchar en voz alta). Para aceptar hay que llegar a la última parte y marcar la declaración de 18 años o más. "Rechazar" y "Después" dejan el asistente en pausa. La aceptación se guarda en el navegador con fecha y versión (`data-version` de `politicas.html`) y se manda al servidor al iniciar sesión. Cambiar `data-version` obliga a aceptar de nuevo.
- **Cuenta:** nombre de usuario o correo y contraseña. **No hay acceso con Google.** Crear cuenta pide usuario, correo, contraseña (mínimo 15 caracteres, configurable), repetirla y confirmar 18 años o más. El código que llega al correo se usa solo al registrarse y al recuperar la contraseña. El token vive solo en memoria: al recargar hay que iniciar sesión otra vez.
- **Borrado:** con la sesión abierta hay "Borrar mis chats guardados" y "Eliminar mi cuenta" (pide la contraseña). Los dos piden confirmación. Cerrar sesión borra además la conversación del navegador.
- **Chat:** manda `{ pregunta, contexto }` a `POST /preguntar` con las últimas 6 líneas. La respuesta se anuncia al lector de pantalla con una región `aria-live` educada y, si la persona lo pide, se lee con la voz del navegador. Enter envía; Mayúsculas + Enter hace salto de línea.
- **Servidor dormido:** al abrir la página se llama a `GET /`. Si una respuesta tarda más de 4 segundos, se avisa y suena un tono de espera cada 3 segundos (se puede apagar).
- **Sin cuentas todavía:** mientras `config.rutas.acceso` y `config.rutas.registro` sean `null`, la página lo avisa y, si `permitirSinCuenta` es `true`, deja usar el chat. En cuanto existan las rutas, el chat exige iniciar sesión.

## Contrato con el servidor (propuesta)

Lo que la página espera. Si el servidor usa otras rutas o nombres, se cambian en `config.v2.js` y `api.v2.js`. Los errores deben traer `{ "detail": "texto en español" }`, porque ese texto se muestra y se lee en voz alta.

| Ruta | Cuerpo | Respuesta | Notas |
|---|---|---|---|
| `POST /cuenta/registro` | `{ usuario, correo, contrasena, mayorDeEdad: true, version }` | `{ requiereCodigo: true \| false }` | El servidor debe exigir `mayorDeEdad` y validar usuario, correo y contraseña con las mismas reglas |
| `POST /cuenta/verificar` | `{ correo, codigo }` | `{ token, usuario }` | Termina el registro |
| `POST /cuenta/acceso` | `{ identificador, contrasena }` | `{ token, usuario }` | `identificador` es correo o usuario. Mismo error si falla cualquiera de los dos |
| `POST /cuenta/recuperar` | `{ correo }` | `200 {}` | Siempre igual, exista o no el correo |
| `POST /cuenta/restablecer` | `{ correo, codigo, contrasena }` | `200 {}` | |
| `POST /cuenta/aceptacion` | `{ version, fecha, mayorDeEdad }` + `Authorization: Bearer` | `200` | Guardar fecha y versión aceptada |
| `DELETE /cuenta/borrarChats` | `Authorization: Bearer` | `200` | Hoy borra todos. Borrar chats individuales exige que `/preguntar` devuelva un identificador de chat |
| `DELETE /cuenta/eliminarCuenta` | `{ contrasena }` + `Authorization: Bearer` | `200` | Borra la cuenta y todos sus datos |

Si `verificacionPorCorreo` es `false`, `registro` debe responder `requiereCodigo: false` y la página pide iniciar sesión sin código. Tampoco se ofrece recuperar la contraseña.

Reglas del servidor que esta página da por hechas (lista de verificación, puntos 2, 3, 7, 9, 12 y 13): contraseñas con Argon2id, sin borrado por inactividad, cupo por usuario (unas 10 personas con 20 a 23 consultas al día), CORS para el origen de GitHub Pages y manejo del error de Neon al llegar a su límite o al despertar.

## Lo que falta y de quién depende

| Pendiente | Quién |
|---|---|
| Desplegar el servidor y poner su URL en `apiBase` (y en `connect-src` de la CSP si no es `*.onrender.com`) | Móvil A |
| CORS para `https://fernandezquintanajose.github.io` y el dominio final | Móvil A |
| Rutas de cuenta, aceptación y borrado (tabla de arriba) y llenar `config.rutas` | Móvil A |
| Proveedor de correo para los códigos. Planes gratuitos que encontré (cifras de fuentes de terceros, sin confirmar en las páginas oficiales): Brevo, 300 correos al día; Resend, 100 al día pero exige dominio propio verificado | Equipo y titular |
| Decidir si se permite usar sin cuenta (`permitirSinCuenta`) | CECAPI y equipo |
| Datos entre corchetes de `politicas.html` y revisión legal (diferida) | CECAPI y asesor |
| Correo de contacto para derechos ARCO: el que confirme CECAPI | CECAPI |
| Llenar `datos/descargas.v1.json` con enlaces a GitHub Releases | Equipos de Android y Windows |
| Dominio | Titular |

## Publicar una versión de app

En `datos/descargas.v1.json`, en la app que corresponda, llenar `version`, `archivo`, `url` (enlace https a GitHub Releases), `tamanoBytes` y `sha256`. Para sacar la suma: `sha256sum archivo` en Linux o `Get-FileHash archivo -Algorithm SHA256` en PowerShell. Mientras `url` esté en `null`, la página dice que no hay versión publicada. Un enlace que no sea de `github.com/<dueño>/<repo>/releases/` se descarta.

## Probar en local

Requiere Node 18 o más reciente.

```
npm install
npx playwright install chromium   # solo la primera vez
npm run servir     # http://localhost:8080/PaginaAsistenteCECAPI/
npm run revisar    # axe (WCAG 2.2 AA), consola y recursos, en 5 tamaños de pantalla y texto al 200 %, en claro, oscuro y contraste alto
npm run flujo      # políticas, chat y panel de ajustes con un servidor simulado
npm run cuenta     # registro, acceso, recuperar, borrar chats y eliminar cuenta con un servidor simulado
npm run descargas  # panel de descargas
```

Los casos de cada prueba están en `docs/CASOS_DE_PRUEBA.md`. Las pruebas automáticas no sustituyen probar con NVDA, JAWS (si hay acceso) y Narrator, ni con TalkBack en el teléfono.

## Seguridad

- Ninguna llave en el JavaScript: cualquier persona puede leerlo.
- CSP en `<meta>`: solo scripts y estilos propios; conexiones solo al servidor. Ya no se permite nada de Google.
- Todo lo que llega del servidor se inserta como texto (`textContent`), nunca como HTML.
- Peticiones con `cache: "no-store"` y sin cookies. El token solo en memoria. Las contraseñas no se guardan en el navegador (los campos usan `autocomplete` para que el administrador de contraseñas decida).
- Antes de publicar: auditoría OWASP Top 10:2025 (CSP, CORS, token).
