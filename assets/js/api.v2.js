// Cliente del servidor de IA. Todos los errores salen como Error con un mensaje en español
// que se puede mostrar y leer en voz alta tal cual.
(function () {
  "use strict";
  var config = window.CECAPI_CONFIG;
  var token = null; // Solo en memoria: se pierde al cerrar la pestaña, a propósito.

  var MENSAJES = {
    sinServidor: "El servidor del asistente todavía no está configurado.",
    sinRuta: "Esta función todavía no está disponible en el servidor.",
    sinConexion: "No se pudo conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.",
    tardo: "El servidor tardó demasiado en responder. Intenta de nuevo en un momento.",
    invalida: "Los datos no son válidos. Revísalos e intenta de nuevo.",
    sesion: "Tu sesión terminó. Vuelve a iniciar sesión.",
    general: "Algo falló en el servidor. Intenta de nuevo en un momento."
  };

  function peticion(metodo, ruta, cuerpo) {
    if (!config.apiBase) return Promise.reject(new Error(MENSAJES.sinServidor));
    if (!ruta) return Promise.reject(new Error(MENSAJES.sinRuta));
    var control = new AbortController();
    var reloj = setTimeout(function () { control.abort(); }, config.esperaMaximaMs);
    var encabezados = { "Accept": "application/json" };
    if (cuerpo !== undefined) encabezados["Content-Type"] = "application/json";
    if (token) encabezados["Authorization"] = "Bearer " + token;

    return fetch(config.apiBase + ruta, {
      method: metodo,
      headers: encabezados,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: control.signal,
      cache: "no-store",
      credentials: "omit"
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (datos) {
        if (res.ok) return datos;
        var detalle = datos && typeof datos.detail === "string" ? datos.detail : null;
        // 401 con sesión abierta: el token venció. Sin sesión (al iniciar) el servidor explica por qué.
        if (res.status === 401 && token) { token = null; throw new Error(detalle || MENSAJES.sesion); }
        if (res.status === 422) throw new Error(detalle || MENSAJES.invalida);
        throw new Error(detalle || MENSAJES.general);
      });
    }, function (error) {
      throw new Error(error && error.name === "AbortError" ? MENSAJES.tardo : MENSAJES.sinConexion);
    }).finally(function () {
      clearTimeout(reloj);
    });
  }

  function guardarSesion(datos) {
    token = datos && datos.token ? datos.token : null;
    if (!token) throw new Error(MENSAJES.general);
    return datos;
  }

  var rutas = config.rutas;

  window.CecapiApi = {
    MENSAJES: MENSAJES,
    configurado: function () { return !!config.apiBase; },
    cuentasDisponibles: function () { return !!(rutas.registro && rutas.acceso); },
    conSesion: function () { return !!token; },

    salud: function () { return peticion("GET", rutas.salud); },
    preguntar: function (pregunta, contexto) {
      return peticion("POST", rutas.preguntar, { pregunta: pregunta, contexto: contexto });
    },

    registrar: function (datos) { return peticion("POST", rutas.registro, datos); },
    verificar: function (correo, codigo) {
      return peticion("POST", rutas.verificar, { correo: correo, codigo: codigo }).then(guardarSesion);
    },
    acceder: function (identificador, contrasena) {
      return peticion("POST", rutas.acceso, { identificador: identificador, contrasena: contrasena }).then(guardarSesion);
    },
    recuperar: function (correo) { return peticion("POST", rutas.recuperar, { correo: correo }); },
    restablecer: function (correo, codigo, contrasena) {
      return peticion("POST", rutas.restablecer, { correo: correo, codigo: codigo, contrasena: contrasena });
    },
    registrarAceptacion: function (registro) {
      if (!rutas.aceptacion || !token) return Promise.resolve(null);
      return peticion("POST", rutas.aceptacion, registro);
    },
    borrarChats: function () { return peticion("DELETE", rutas.borrarChats); },
    eliminarCuenta: function (contrasena) {
      return peticion("DELETE", rutas.eliminarCuenta, { contrasena: contrasena }).then(function (r) { token = null; return r; });
    },
    cerrarSesion: function () { token = null; }
  };
})();
