# Casos de prueba del asistente web (para el capítulo IV)

Fecha: 30 oct 2026. Rama `main`. Las pruebas automáticas usan Chromium con Playwright, un servidor local que imita GitHub Pages y un servidor de IA **simulado**: todavía no se han probado contra el servidor real.

Cómo se ejecutan: `npm run revisar`, `npm run flujo`, `npm run cuenta`, `npm run descargas` (ver `README.md`).

## 1. Políticas y aceptación (`pruebas/flujo.mjs`)

| ID | Caso | Resultado esperado |
|---|---|---|
| P-01 | Abrir la página sin haber aceptado | Aparecen las políticas y el chat está oculto |
| P-02 | Pulsar Aceptar sin llegar a la última parte | Mensaje "primero llega a la última parte"; no acepta |
| P-03 | Avanzar con Siguiente | El foco va al título de cada parte; el último botón dice "Ir a la decisión" |
| P-04 | Aceptar sin marcar 18 años o más | Mensaje de que falta la declaración; no acepta |
| P-05 | Aceptar con todo cumplido | Aparece el chat y el foco queda en el campo de pregunta |
| P-06 | Aceptar | Se guarda la aceptación con versión y fecha |
| P-07 | Recargar la página tras aceptar | No vuelve a pedir las políticas |

## 2. Cuenta (`pruebas/cuenta.mjs`)

| ID | Caso | Resultado esperado |
|---|---|---|
| C-01 | Cuentas disponibles y sin sesión | El chat espera el inicio de sesión; se ve el acceso |
| C-02 | Mostrar y ocultar contraseña | El campo cambia entre texto y contraseña |
| C-03 | Registro con usuario vacío, con acentos o eñe, correo vacío o sin dominio, contraseña corta, contraseñas distintas o sin declarar 18+ | Un error claro por caso, el campo queda marcado y recibe el foco |
| C-04 | Registro válido con verificación por correo | Pide el código y dice a qué correo se envió; el registro manda mayoría de edad y versión de políticas |
| C-05 | Código vacío o incorrecto | Mensaje de error (el del servidor si es incorrecto) |
| C-06 | Código correcto | Inicia sesión, aparece el chat, registra la aceptación con fecha y versión |
| C-07 | Preguntar con sesión | La pregunta lleva el token |
| C-08 | Borrar mis chats | Pide confirmación; Cancelar devuelve el foco; Confirmar llama al servidor y vacía la conversación |
| C-09 | Cerrar sesión | Oculta el chat y vuelve al acceso |
| C-10 | Acceso con contraseña equivocada | Mensaje del servidor |
| C-11 | Acceso con el correo y con el nombre de usuario | Ambos entran |
| C-12 | Recuperar contraseña con un correo sin cuenta | El aviso es el mismo que con un correo con cuenta |
| C-13 | Restablecer con código incorrecto y con código correcto | Falla con mensaje; con el correcto cambia la contraseña y entra con la nueva |
| C-14 | Eliminar cuenta sin contraseña, con contraseña equivocada y con la correcta | Exige contraseña; con la equivocada no elimina; con la correcta borra la cuenta, cierra sesión y ofrece crear otra |
| C-15 | Sin verificación por correo | No ofrece recuperar contraseña; al registrarse pasa al acceso sin pedir código |
| C-16 | Servidor sin rutas de cuenta | Avisa que las cuentas no están disponibles, no muestra formularios y deja usar el chat |
| C-17 | Toda la sesión de prueba | Ninguna petición a Google y sin errores de JavaScript |
| C-18 | Accesibilidad automática en acceso, registro y recuperar | axe sin fallas (WCAG 2.2 AA y buenas prácticas) |

## 3. Chat y panel de ajustes (`pruebas/flujo.mjs`)

| ID | Caso | Resultado esperado |
|---|---|---|
| H-01 | Enviar una pregunta vacía | Error visible y foco en el campo |
| H-02 | Enviar una pregunta con el servidor lento | Avisa que el servidor está despertando |
| H-03 | Recibir una respuesta | Se muestra, se anuncia al lector de pantalla y quita el aviso |
| H-04 | Respuesta de error del servidor (429) | Se muestra el mensaje del servidor |
| H-05 | Segunda pregunta | Manda las líneas anteriores como contexto |
| A-01 | Abrir y cerrar el panel de ajustes | Empuja el contenido; Escape y tocar fuera lo cierran; Escape devuelve el foco al botón |
| A-02 | Texto más grande, tema oscuro | La letra crece y el tema se aplica |

## 4. Descargas (`pruebas/descargas.mjs`)

| ID | Caso | Resultado esperado |
|---|---|---|
| D-01 | Enlace de GitHub Releases | Se muestra con versión, tamaño y SHA-256 |
| D-02 | Enlace a otro sitio, con http o fuera de `/releases/` | Se descarta: "todavía no hay versión" |
| D-03 | Texto de la página | Aclara que no están en Google Play ni en la Microsoft Store |

## 5. Accesibilidad y pantallas (`pruebas/revisar.mjs`)

Para cada página (inicio, políticas, descargas y error 404), en claro, oscuro, contraste alto, oscuro forzado, claro forzado y texto al 200 %, y en celular (375 px), tablet (768 y 1024 px), laptop (1366 px) y pantalla grande (1920 px): sin errores de consola, sin recursos que no carguen, sin fallas de axe y sin desplazamiento horizontal.

## 6. Pruebas manuales pendientes

No están hechas. Necesitan personas y dispositivos.

| ID | Caso | Con qué |
|---|---|---|
| M-01 | Recorrer inicio, políticas, cuenta, chat y descargas con encabezados, formularios y botones | NVDA y Narrator en Windows; JAWS si hay acceso |
| M-02 | Lo mismo en el teléfono | TalkBack en Android |
| M-03 | Voz del navegador en español (políticas y respuestas) | Chrome, Edge, Firefox y Safari |
| M-04 | Probar el chat y la cuenta contra el servidor real | Cuando esté desplegado |
| M-05 | Probar con estudiantes de CECAPI y anotar qué lector de pantalla usan | Reunión con CECAPI |
