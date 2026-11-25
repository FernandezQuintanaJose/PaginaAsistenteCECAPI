// Configuración del asistente web. Es pública: aquí NO va ninguna llave ni secreto.
// Al cambiar apiBase, añadir el mismo origen a connect-src en la CSP de index.html.
window.CECAPI_CONFIG = {
  // Dirección del servidor de IA, sin "/" al final. Vacía: el chat avisa que no está configurado.
  // Ejemplo: "https://cecapi-asistente.onrender.com"
  apiBase: "",

  // Rutas del servidor. null = el servidor todavía no la tiene; la página lo avisa y no falla.
  // Las de cuenta son una PROPUESTA para el equipo del servidor; ver README ("Contrato con el servidor").
  rutas: {
    salud: "/",                 // GET, sin clave; no toca la base de datos
    preguntar: "/preguntar",    // POST { pregunta, contexto } -> { respuesta, proveedor, hayMas }
    registro: null,             // POST { usuario, correo, contrasena, mayorDeEdad } -> { requiereCodigo }
    verificar: null,            // POST { correo, codigo } -> { token, usuario }
    acceso: null,               // POST { identificador, contrasena } -> { token, usuario }
    recuperar: null,            // POST { correo } -> 200 siempre, exista o no el correo
    restablecer: null,          // POST { correo, codigo, contrasena } -> 200
    aceptacion: null,           // POST { version, fecha, mayorDeEdad } con Authorization: Bearer
    borrarChats: null,          // DELETE con Authorization: Bearer
    eliminarCuenta: null        // DELETE { contrasena } con Authorization: Bearer
  },

  // El servidor manda un código al correo al registrarse y al recuperar la contraseña.
  // Poner en false si no se puede enviar correo (el código es solo para esos dos casos).
  verificacionPorCorreo: true,

  // Reglas de cuenta. El servidor debe aplicar las mismas: estas solo ahorran un viaje.
  contrasenaMinima: 15,
  usuarioMinimo: 3,
  usuarioMaximo: 30,

  // Uso sin cuenta: SIN DECIDIR (ficha). Solo aplica mientras el servidor no tenga cuentas;
  // en cuanto exista la ruta de acceso, el chat pide iniciar sesión.
  permitirSinCuenta: true,

  // Tiempo máximo de espera. Render tarda cerca de un minuto en despertar.
  esperaMaximaMs: 90000,
  // A partir de cuánto se avisa que el servidor está despertando.
  avisoDespertarMs: 4000
};
