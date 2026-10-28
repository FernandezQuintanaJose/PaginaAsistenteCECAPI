// Configuración del asistente web. Es pública: aquí NO va ninguna llave ni secreto.
// Al cambiar apiBase, añadir el mismo origen a connect-src en la CSP de index.html.
window.CECAPI_CONFIG = {
  // Dirección del servidor de IA, sin "/" al final. Vacía: el chat avisa que no está configurado.
  // Ejemplo: "https://cecapi-asistente.onrender.com"
  apiBase: "",

  // ID de cliente OAuth de Google (tipo "Aplicación web"). Es público por diseño.
  // Vacío: no se muestra el botón de Google.
  googleClientId: "",

  rutas: {
    salud: "/",              // GET, sin clave; no toca la base de datos
    preguntar: "/preguntar", // POST { pregunta, contexto } -> { respuesta, proveedor, hayMas }
    // Aún no existen en el servidor (ficha del backend, tareas 3 y 4). Dejar en null hasta entonces.
    sesion: null,            // POST { idToken } -> { token, nombre }
    aceptacion: null         // POST { version, mayorDeEdad } con Authorization: Bearer <token>
  },

  // Uso sin cuenta: SIN DECIDIR (ficha). Queda en true mientras el servidor no tenga cuentas.
  permitirSinCuenta: true,

  // Tiempo máximo de espera. Render tarda cerca de un minuto en despertar.
  esperaMaximaMs: 90000,
  // A partir de cuánto se avisa que el servidor está despertando.
  avisoDespertarMs: 4000
};
