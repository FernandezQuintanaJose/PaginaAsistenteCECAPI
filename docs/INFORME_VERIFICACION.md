# Informe de verificación del código (lista de 32 puntos)

Fecha: 30 oct 2026. Responsable de la lista: José Fernández Quintana. Revisado por Claude Code.

## Qué se revisó y qué no

- **App Android y servidor** (`EstadiasAppMobil`): rama `modulo03/integracion`, tal como estaba al hacer `git fetch` durante la revisión (hoy apunta a `5c03d39`). Búsquedas con `git grep`. "No encontré" significa búsqueda sin resultados, no prueba absoluta.
- **Asistente web** (`PaginaAsistenteCECAPI`) y **sitio CECAPI** (`PaginaCECAPI`): rama `main`.
- **App de Windows** (`WindowsCECAPI`): repositorio vacío.
- **No se pudo revisar:** el módulo de gestos de accesibilidad y la memoria que describe el `AccessibilityService`.
- No se cambió ningún texto de aviso por iniciativa propia: las diferencias entre texto y código están en el punto 31.

## Decisiones tomadas el 30 oct 2026 que cambian la lista

1. Inicio de sesión: usuario o correo y contraseña. Sin Google. El código por correo solo para registrarse y recuperar la contraseña; si enviar correo costara dinero, se haría sin código. Los planes gratuitos encontrados alcanzan para unas 10 personas, así que va con correo.
2. Windows: solo `.exe` por GitHub Releases. Microsoft Store descartada definitivamente.

## A. Servicio de IA (servidor)

| N.º | Resultado | Archivo y línea | Nota |
|---|---|---|---|
| 1 | No cumple | `backend/` (sin SQLAlchemy, Alembic, CORS ni archivos de despliegue) | No hay cuentas, base de datos, tokens, CORS ni despliegue. Hay `backend/main.py`, `seguridad.py`, `uso.py`, `privacidad.py`, `proveedores.py` |
| 2 | No cumple | Servidor: ninguna ruta de registro o acceso. Cliente web listo: `PaginaAsistenteCECAPI/assets/js/asistente.v2.js:285` y `:296` | Contrato propuesto en el README del asistente |
| 3 | No cumple | No se encontró Argon2, bcrypt ni passlib | Depende de que exista el registro |
| 4 | Cumple | `backend/proveedores.py` (`ver_con_respaldo`); orden en `backend/.env.example` (`IA_ORDEN`) | Si un proveedor falla pasa al otro |
| 5 | Cumple, con matiz | `backend/main.py:284` (`/preguntar`), `:311` (`/entender`), `:217` (contexto); `backend/privacidad.py:18` | El filtro se aplica antes de la IA y el comentario no afirma cubrir todo. `/ver` recibe solo una imagen, sin texto de la persona |
| 6 | Cumple | `backend/proveedores.py`, `backend/prompts_vision.py`, `backend/main.py` | No encontré instrucciones que pidan datos de salud |
| 7 | No cumple | No hay base de datos ni regla de conservación | El texto ya dice "mientras tu cuenta exista, sin borrado por inactividad": `PaginaAsistenteCECAPI/politicas.html:129` |
| 8 | No cumple | Servidor: sin rutas de borrado. Cliente: `asistente.v2.js:387` (borrar chats) y `:402` (eliminar cuenta) | El cliente borra **todos** los chats. Borrar chats individuales exige que `/preguntar` devuelva un identificador de chat |
| 9 | No cumple en el servidor | Cliente: `asistente.v2.js:296` (exige marcar 18+ y manda `mayorDeEdad`) | El servidor no lo valida porque no tiene registro |
| 10 | Parcial | Cliente: `asistente.v2.js:118-137` y `:222`; servidor sin ruta de aceptación | Las políticas se leen y aceptan antes de la primera pregunta y se guardan fecha y versión en el navegador. El servidor aún no las guarda |
| 11 | No cumple | `app/src/main/AndroidManifest.xml:39` (`usesCleartextTraffic="true"`); servidor sin CORS | No encontré claves en el repositorio. En la web, la CSP solo permite conexiones al servidor y las peticiones usan `no-store` y sin cookies (`assets/js/api.v2.js:32`) |
| 12 | No cumple | `backend/seguridad.py:7` y `:38` (por IP, 20 por minuto); `backend/uso.py` (por proveedor) | No hay cupo por usuario |
| 13 | No cumple | No hay Neon en el código | Falta manejar el límite de escritura y el despertar de Neon |

## B. App móvil (Android)

| N.º | Resultado | Archivo y línea | Nota |
|---|---|---|---|
| 14 | No cumple | `app/src/main/java/com/cecapi/app/feature/modulo1_aplicacionprincipal/SettingsScreen.kt:191` ("Privacidad" es solo un ajuste) | No hay pantalla de aceptación ni bloqueo de la IA |
| 15 | No cumple | Sin coincidencias | No hay advertencia de no dictar datos sensibles |
| 16 | No se puede determinar | `LoginViewModel.kt` (registro local) | No confirmé borrado de chats ni de cuenta |
| 17 | Cumple | Sin coincidencias de Google Play en `app/` ni `README.md` | |
| 18 | No se puede determinar | Sin coincidencias de `AccessibilityService` | Hace falta la memoria para comparar |
| 19 | No se puede determinar | Dependencia en `app/build.gradle.kts:88`; `SharedPreferences` en `core/di/DatabaseModule.kt:108` | No ubiqué dónde se guarda la velocidad de la voz |

## C. App de Windows

| N.º | Resultado | Archivo y línea | Nota |
|---|---|---|---|
| 20 | Sin código | `WindowsCECAPI` vacío | Decisión: solo `.exe` por GitHub Releases. Ficha actualizada |
| 21 | Sin código | | |
| 22 | Pendiente | | Prueba técnica: app mínima empaquetada como `.exe` antes de la completa |
| 23 | Sin código | | |

## D. Asistente web y lector

| N.º | Resultado | Archivo y línea | Nota |
|---|---|---|---|
| 24 | Parcial | `asistente.v2.js:285-330` | Chat, cuenta propia y aceptación listos en el cliente; faltan las rutas del servidor |
| 25 | Cumple | `assets/js/descargas.v2.js:19` (solo `github.com/.../releases/`); `datos/descargas.v1.json` | Aún sin enlaces: no hay versiones publicadas |
| 26 | Cumple | `docs/CASOS_DE_PRUEBA.md`; `pruebas/` | Faltan las pruebas manuales con lectores de pantalla (sección 6) |

## E. Sitio CECAPI

| N.º | Resultado | Archivo y línea | Nota |
|---|---|---|---|
| 27 | Cumple | `PaginaCECAPI/index.html` (sección del asistente) | No aloja APK ni `.exe`; solo enlaza al asistente y a su página de descargas |
| 28 | No cumple | `PaginaCECAPI/index.html:146-147` | El pie enlaza `aviso-privacidad.html` y `terminos.html`, que son borradores. **Pendiente de decisión** (propuesta: quitar los enlaces y las páginas hasta que CECAPI apruebe) |
| 29 | Cumple | `PaginaAsistenteCECAPI/politicas.html:136-141` | El correo de derechos está como "por confirmar con CECAPI"; no se puso ninguno |

## F. Gestos de accesibilidad

| N.º | Resultado | Archivo y línea | Nota |
|---|---|---|---|
| 30 | No se puede determinar | | No identifiqué ese módulo en lo revisado |

## G. Coherencia con los documentos

| N.º | Resultado | Nota |
|---|---|---|
| 31 | Hay diferencias | Lo que `politicas.html` afirma y el código aún no cumple: (a) contraseñas cifradas y (b) borrado de cuenta y chats, porque no existen en el servidor; (c) "tienes 18 años o más" al crear la cuenta, solo en la web; la app no lo pide; (d) HTTPS: la app permite tráfico sin cifrar (`AndroidManifest.xml:39`); (e) el plazo de conservación quedó "mientras exista la cuenta", pero no hay base de datos que lo cumpla. Las demás afirmaciones sí coinciden: filtro de privacidad, proveedores Gemini y Groq, sin datos de salud |
| 32 | Cumple | No se agregaron funciones fuera de la documentación. Lo añadido (cuenta propia, borrado, descargas solo de GitHub Releases) sale de la lista y de las decisiones del 30 oct |

## Pendientes que no dependen del código

Capítulos IV y V y resumen de las memorias; datos de reuniones con CECAPI y tabla de autoría; revisión de títulos con el asesor y de formato en Word; confirmar el medio de contacto de CECAPI para derechos sobre los datos; revisión legal del aviso y los términos (diferida).
