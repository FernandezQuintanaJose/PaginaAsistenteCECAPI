// Cliente del servidor de IA. Todos los errores salen como Error con un mensaje en español
// que se puede mostrar y leer en voz alta tal cual.
(function () {
  "use strict";
  var config = window.CECAPI_CONFIG;
  var token = null; // Solo en memoria: se pierde al cerrar la pestaña, a propósito.

  var MENSAJES = {
    sinServidor: "El servidor del asistente todavía no está configurado.",
    sinConexion: "No se pudo conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.",
    tardo: "El servidor tardó demasiado en responder. Intenta de nuevo en un momento.",
    invalida: "La pregunta no es válida. Revisa que no esté vacía y que tenga menos de 2,000 caracteres.",
    sesion: "Tu sesión terminó. Vuelve a iniciar sesión.",
    general: "Algo falló en el servidor. Intenta de nuevo en un momento."
  };

  function peticion(metodo, ruta, cuerpo) {
    if (!config.apiBase || !ruta) return Promise.reject(new Error(MENSAJES.sinServidor));
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
        if (res.status === 401) token = null;
        var detalle = datos && typeof datos.detail === "string" ? datos.detail : null;
        if (res.status === 422) throw new Error(MENSAJES.invalida);
        if (res.status === 401 && !detalle) throw new Error(MENSAJES.sesion);
        throw new Error(detalle || MENSAJES.general);
      });
    }, function (error) {
      throw new Error(error && error.name === "AbortError" ? MENSAJES.tardo : MENSAJES.sinConexion);
    }).finally(function () {
      clearTimeout(reloj);
    });
  }

  window.CecapiApi = {
    MENSAJES: MENSAJES,
    configurado: function () { return !!config.apiBase; },
    salud: function () { return peticion("GET", config.rutas.salud); },
    preguntar: function (pregunta, contexto) {
      return peticion("POST", config.rutas.preguntar, { pregunta: pregunta, contexto: contexto });
    },
    iniciarSesion: function (idToken) {
      return peticion("POST", config.rutas.sesion, { idToken: idToken }).then(function (datos) {
        token = datos && datos.token ? datos.token : null;
        if (!token) throw new Error(MENSAJES.general);
        return datos;
      });
    },
    registrarAceptacion: function (registro) {
      if (!config.rutas.aceptacion || !token) return Promise.resolve(null);
      return peticion("POST", config.rutas.aceptacion, registro);
    },
    cerrarSesion: function () { token = null; },
    conSesion: function () { return !!token; }
  };
})();
