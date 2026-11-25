# Ficha: Asistente web y chatbot (PaginaAsistenteCECAPI)

Equipo de 3 (Móvil A puede apoyar). Complementa la ficha global (`00_global`). El repositorio está vacío.

## Objetivo
Página estilo asistente (similar a las de Claude o ChatGPT) para conversar con la IA de CECAPI, más un panel de descargas de la app Android (APK) y de Windows.

## Tipo y plataforma
Sitio estático: HTML, CSS y JavaScript simples. Sin PHP. Publicación en GitHub Pages; descargas por GitHub Releases. Consume la API del servidor con HTTPS.

## Funciones
1. Chat con la IA (texto), respuestas leídas correctamente por lectores de pantalla (región `aria-live` educada, foco gestionado).
2. Cuenta propia: usuario o correo y contraseña, con código por correo solo para registrarse y recuperar la contraseña (sin Google). Borrar chats y eliminar la cuenta. Posible modo sin cuenta con cupo muy reducido: SIN DECIDIR.
3. Políticas de uso y privacidad en pantalla y con audio (repetir, siguiente, aceptar, rechazar, después), declaración 18+.
4. Panel de descargas: APK y `.exe` de Windows con versión, tamaño y suma de verificación; solo enlaces a GitHub Releases.
5. Mensaje claro cuando el servidor está despertando.

## Tareas, en orden
1. Estructura base, semántica, navegación por teclado, contraste y tamaño de texto ajustable.
2. Cliente de la API con manejo de errores y tiempos de espera.
3. Cuenta propia (registro, código por correo, acceso, recuperar contraseña, borrar chats, eliminar cuenta). HECHA en el cliente con servidor simulado; faltan las rutas del servidor.
4. Pantallas de políticas con audio (reutilizar textos de la ficha global).
5. Panel de descargas.
6. Pruebas con NVDA, JAWS (si hay acceso) y Narrator; revisión automática de accesibilidad.
7. Caché: archivos versionados; nada autenticado en caché.
8. Auditoría OWASP básica (CSP, no guardar tokens en almacenamiento persistente sin necesidad).

## Herramientas
frontend-design, playwright (pruebas), OWASP Security Audit, context7.

## Riesgos
CORS mal configurado; exposición de llaves si se pone una compartida en JavaScript (no hacerlo); costo de la IA si se abre sin cuenta.

## Costos
GitHub Pages y Releases: gratuitos. Dominio: lo paga el titular (precio SIN VERIFICAR).

## Por decidir
Nombre y dominio; modo sin cuenta; paleta (reunión con CECAPI).
