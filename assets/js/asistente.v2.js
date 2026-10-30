// Página del asistente: políticas por partes, cuenta propia (usuario o correo y contraseña) y chat.
// Todo texto que viene del servidor se inserta con textContent, nunca como HTML.
(function () {
  "use strict";
  var config = window.CECAPI_CONFIG;
  var api = window.CecapiApi;
  var voz = window.CecapiVoz || { disponible: false, decir: function () {}, callar: function () {} };

  function $(id) { return document.getElementById(id); }
  function leer(clave) { try { return window.localStorage.getItem(clave); } catch (e) { return null; } }
  function guardar(clave, valor) { try { window.localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ } }
  function borrar(clave) { try { window.localStorage.removeItem(clave); } catch (e) { /* sin almacenamiento */ } }

  function anunciar(texto) {
    var region = $("anuncio");
    region.textContent = "";
    // Vaciar y volver a llenar hace que el lector anuncie aunque el texto se repita.
    setTimeout(function () { region.textContent = texto; }, 60);
  }

  function estado(texto) {
    var aviso = $("estado-servidor");
    aviso.textContent = texto || "";
    aviso.hidden = !texto;
  }

  // ------------------------------------------------------------------ Políticas
  var partes = [];
  var versionPoliticas = null;
  var indice = 0;
  var maxVisto = 0;
  var vozPoliticas = false;

  function cargarPoliticas() {
    return fetch("politicas.html", { cache: "no-cache" })
      .then(function (res) { if (!res.ok) throw new Error(); return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var articulo = doc.getElementById("texto-politicas");
        versionPoliticas = articulo.getAttribute("data-version");
        partes = Array.prototype.map.call(articulo.querySelectorAll(".parte-politica"), function (s) {
          return {
            titulo: s.querySelector("h2").textContent.trim(),
            parrafos: Array.prototype.map.call(s.querySelectorAll("p"), function (p) { return p.textContent.trim(); })
          };
        });
        if (!partes.length) throw new Error();
      });
  }

  function aceptacionVigente() {
    try {
      var registro = JSON.parse(leer("cecapi.politicas"));
      return registro && registro.version === versionPoliticas && registro.mayorDeEdad === true ? registro : null;
    } catch (e) { return null; }
  }

  function mostrarParte(i, conFoco) {
    indice = i;
    maxVisto = Math.max(maxVisto, i);
    var parte = partes[i];
    var caja = $("politica-parte");
    caja.textContent = "";
    var titulo = document.createElement("h3");
    titulo.setAttribute("tabindex", "-1");
    var prefijo = document.createElement("span");
    prefijo.className = "solo-lector";
    prefijo.textContent = "Parte " + (i + 1) + " de " + partes.length + ". ";
    titulo.appendChild(prefijo);
    titulo.appendChild(document.createTextNode(parte.titulo));
    caja.appendChild(titulo);
    parte.parrafos.forEach(function (texto) {
      var p = document.createElement("p");
      p.textContent = texto;
      caja.appendChild(p);
    });
    $("politica-progreso").textContent = "Parte " + (i + 1) + " de " + partes.length + ".";
    $("politica-siguiente").textContent = i === partes.length - 1 ? "Ir a la decisión" : "Siguiente";
    if (conFoco) titulo.focus();
    if (vozPoliticas) voz.decir("Parte " + (i + 1) + " de " + partes.length + ". " + parte.titulo + ". " + parte.parrafos.join(" "));
  }

  function mostrarPoliticas() {
    $("sin-aceptar").hidden = true;
    $("cuenta").hidden = true;
    $("chat").hidden = true;
    $("politicas").hidden = false;
    $("politica-requisito").textContent = "";
  }

  function pausar(motivo) {
    voz.callar();
    vozPoliticas = false;
    $("politica-escuchar").setAttribute("aria-pressed", "false");
    $("politicas").hidden = true;
    $("sin-aceptar-motivo").textContent = motivo;
    $("sin-aceptar").hidden = false;
    $("sin-aceptar").focus();
  }

  function prepararPoliticas() {
    if (!voz.disponible) {
      $("politica-escuchar").disabled = true;
      $("politica-escuchar").textContent = "Voz no disponible en este navegador";
    }
    $("politica-escuchar").addEventListener("click", function () {
      vozPoliticas = !vozPoliticas;
      this.setAttribute("aria-pressed", String(vozPoliticas));
      if (vozPoliticas) mostrarParte(indice, false); else voz.callar();
    });
    $("politica-repetir").addEventListener("click", function () { mostrarParte(indice, true); });
    $("politica-siguiente").addEventListener("click", function () {
      if (indice < partes.length - 1) { mostrarParte(indice + 1, true); return; }
      voz.callar();
      $("politica-edad").focus();
    });

    $("politica-aceptar").addEventListener("click", function () {
      var requisito = $("politica-requisito");
      if (maxVisto < partes.length - 1) {
        requisito.textContent = "Para aceptar, primero llega a la última parte. Vas en la parte " +
          (indice + 1) + " de " + partes.length + ".";
        $("politica-siguiente").focus();
        return;
      }
      if (!$("politica-edad").checked) {
        requisito.textContent = "Para aceptar, marca la declaración de que tienes 18 años o más.";
        $("politica-edad").focus();
        return;
      }
      var registro = { version: versionPoliticas, fecha: new Date().toISOString(), mayorDeEdad: true };
      guardar("cecapi.politicas", JSON.stringify(registro));
      api.registrarAceptacion(registro).catch(function () { /* se reintenta al iniciar sesión */ });
      voz.callar();
      $("politicas").hidden = true;
      mostrarAsistente(true);
    });
    $("politica-rechazar").addEventListener("click", function () {
      borrar("cecapi.politicas");
      pausar("No aceptaste las políticas, por eso el asistente no está disponible. Puedes leerlas de nuevo cuando quieras.");
    });
    $("politica-despues").addEventListener("click", function () {
      pausar("Dejaste las políticas para después. El asistente se activa cuando las aceptes.");
    });
    $("volver-politicas").addEventListener("click", function () {
      mostrarPoliticas();
      mostrarParte(indice, true);
    });
  }

  // ------------------------------------------------------------------ Cuenta
  // Cuenta propia: nombre de usuario o correo y contraseña. El código que llega al correo
  // se usa solo al registrarse y al recuperar la contraseña. No hay acceso con Google.
  var FORMULARIOS = ["f-acceso", "f-registro", "f-codigo", "f-recuperar", "f-restablecer"];
  var correoPendiente = "";
  var formularioActual = null;
  var abrioConfirmacion = null;

  function estadoCuenta(texto) { $("cuenta-estado").textContent = texto; }
  function cuentasDisponibles() { return api.cuentasDisponibles(); }
  function chatPermitido() {
    return api.conSesion() || (!cuentasDisponibles() && config.permitirSinCuenta);
  }

  function ocultarFormularios() {
    FORMULARIOS.forEach(function (id) { $(id).hidden = true; });
  }

  function limpiarErrores(formulario) {
    var error = formulario.querySelector(".error");
    if (error) { error.textContent = ""; error.hidden = true; }
    Array.prototype.forEach.call(formulario.querySelectorAll("[aria-invalid]"), function (c) { c.removeAttribute("aria-invalid"); });
  }

  // Muestra el error en el formulario, marca el campo y le lleva el foco.
  function falla(formulario, texto, campo) {
    var error = formulario.querySelector(".error");
    error.textContent = texto;
    error.hidden = false;
    if (campo) { campo.setAttribute("aria-invalid", "true"); campo.focus(); }
  }

  function mostrarFormulario(id, conFoco) {
    ocultarFormularios();
    formularioActual = id;
    var formulario = $(id);
    limpiarErrores(formulario);
    formulario.hidden = false;
    Array.prototype.forEach.call($("cuenta-modos").querySelectorAll("[data-modo]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-modo") === id));
    });
    if (conFoco) formulario.querySelector("h3").focus();
  }

  function refrescarCuenta() {
    var sesion = api.conSesion();
    var disponibles = cuentasDisponibles();
    $("cuenta-sesion").hidden = !sesion;
    $("cuenta-modos").hidden = sesion || !disponibles;
    if (!sesion) $("confirmar").hidden = true;
    if (sesion || !disponibles) ocultarFormularios();
    else if (!formularioActual || $(formularioActual).hidden) mostrarFormulario(formularioActual || "f-acceso", false);
    $("ir-recuperar").hidden = !config.verificacionPorCorreo;
    if (sesion) return;
    if (!disponibles) {
      estadoCuenta("Las cuentas todavía no están disponibles en el servidor." +
        (config.permitirSinCuenta ? " Mientras tanto puedes usar el asistente sin cuenta." : ""));
    } else if (!$("cuenta-estado").textContent) {
      estadoCuenta("Inicia sesión o crea una cuenta para usar el asistente.");
    }
  }

  function actualizarChat() {
    $("chat").hidden = !chatPermitido();
    refrescarCuenta();
  }

  function alIniciarSesion(datos) {
    estadoCuenta("Sesión iniciada" + (datos.usuario ? " como " + datos.usuario : "") + ".");
    anunciar($("cuenta-estado").textContent);
    var registro = aceptacionVigente();
    if (registro) api.registrarAceptacion(registro).catch(function () { /* se reintenta en el próximo inicio */ });
    formularioActual = null;
    actualizarChat();
    $("pregunta").focus();
  }

  // Envía un formulario: valida, bloquea el botón mientras espera y muestra el error del servidor.
  function conectar(id, validar, enviar) {
    var formulario = $(id);
    formulario.addEventListener("submit", function (evento) {
      evento.preventDefault();
      if (formulario.getAttribute("aria-busy") === "true") return;
      limpiarErrores(formulario);
      var problema = validar(formulario);
      if (problema) { falla(formulario, problema.texto, problema.campo); return; }
      var boton = formulario.querySelector("button[type=submit]");
      formulario.setAttribute("aria-busy", "true");
      boton.setAttribute("aria-disabled", "true");
      Promise.resolve(enviar(formulario)).then(null, function (error) {
        falla(formulario, error.message, null);
        formulario.querySelector(".error").focus();
      }).then(function () {
        formulario.removeAttribute("aria-busy");
        boton.removeAttribute("aria-disabled");
      });
    });
  }

  function errorUsuario(valor) {
    var largo = valor.length >= config.usuarioMinimo && valor.length <= config.usuarioMaximo;
    if (largo && /^[A-Za-z0-9._]+$/.test(valor)) return null;
    return "El nombre de usuario debe tener entre " + config.usuarioMinimo + " y " + config.usuarioMaximo +
      " caracteres: letras sin acento, números, punto o guion bajo.";
  }
  function errorCorreo(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor) ? null : "Escribe un correo válido, por ejemplo nombre@correo.com.";
  }
  function errorContrasena(valor) {
    return valor.length >= config.contrasenaMinima ? null :
      "La contraseña debe tener al menos " + config.contrasenaMinima + " caracteres. Puede ser una frase.";
  }
  function campo(formulario, nombre) { return formulario.elements[nombre]; }
  function valor(formulario, nombre) { return campo(formulario, nombre).value.trim(); }

  function prepararCuenta() {
    $("cuenta").hidden = false;
    $("politica-requisito").textContent = "";

    Array.prototype.forEach.call(document.querySelectorAll("[data-modo]"), function (b) {
      b.addEventListener("click", function () { estadoCuenta(""); mostrarFormulario(b.getAttribute("data-modo"), true); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-ir]"), function (b) {
      b.addEventListener("click", function () { mostrarFormulario(b.getAttribute("data-ir"), true); });
    });
    // "Mostrar contraseña": un solo control por formulario.
    Array.prototype.forEach.call(document.querySelectorAll("[data-mostrar]"), function (casilla) {
      casilla.addEventListener("change", function () {
        Array.prototype.forEach.call(casilla.form.querySelectorAll("[data-clave]"), function (c) {
          c.type = casilla.checked ? "text" : "password";
        });
      });
    });

    conectar("f-acceso", function (f) {
      if (!valor(f, "identificador")) return { texto: "Escribe tu correo o tu nombre de usuario.", campo: campo(f, "identificador") };
      if (!campo(f, "contrasena").value) return { texto: "Escribe tu contraseña.", campo: campo(f, "contrasena") };
      return null;
    }, function (f) {
      return api.acceder(valor(f, "identificador"), campo(f, "contrasena").value).then(function (datos) {
        f.reset();
        alIniciarSesion(datos);
      });
    });

    conectar("f-registro", function (f) {
      var e = errorUsuario(valor(f, "usuario")); if (e) return { texto: e, campo: campo(f, "usuario") };
      e = errorCorreo(valor(f, "correo")); if (e) return { texto: e, campo: campo(f, "correo") };
      e = errorContrasena(campo(f, "contrasena").value); if (e) return { texto: e, campo: campo(f, "contrasena") };
      if (campo(f, "contrasena").value !== campo(f, "repetir").value) return { texto: "Las dos contraseñas no son iguales.", campo: campo(f, "repetir") };
      if (!campo(f, "mayor").checked) return { texto: "Para crear la cuenta, marca que tienes 18 años o más.", campo: campo(f, "mayor") };
      return null;
    }, function (f) {
      var correo = valor(f, "correo");
      return api.registrar({
        usuario: valor(f, "usuario"), correo: correo, contrasena: campo(f, "contrasena").value,
        mayorDeEdad: true, version: versionPoliticas
      }).then(function (r) {
        f.reset();
        if (config.verificacionPorCorreo && (!r || r.requiereCodigo !== false)) {
          correoPendiente = correo;
          $("codigo-aviso").textContent = "Te enviamos un código a " + correo + ". Escríbelo aquí para terminar de crear tu cuenta.";
          mostrarFormulario("f-codigo", true);
          anunciar($("codigo-aviso").textContent);
        } else {
          estadoCuenta("Tu cuenta se creó. Ahora inicia sesión.");
          mostrarFormulario("f-acceso", true);
        }
      });
    });

    conectar("f-codigo", function (f) {
      return valor(f, "codigo") ? null : { texto: "Escribe el código que te llegó al correo.", campo: campo(f, "codigo") };
    }, function (f) {
      return api.verificar(correoPendiente, valor(f, "codigo")).then(function (datos) {
        f.reset();
        alIniciarSesion(datos);
      });
    });

    conectar("f-recuperar", function (f) {
      var e = errorCorreo(valor(f, "correo")); return e ? { texto: e, campo: campo(f, "correo") } : null;
    }, function (f) {
      var correo = valor(f, "correo");
      return api.recuperar(correo).then(function () {
        correoPendiente = correo;
        f.reset();
        // La respuesta es la misma exista o no el correo, para no revelar quién tiene cuenta.
        $("restablecer-aviso").textContent = "Si ese correo tiene una cuenta, le enviamos un código. Escríbelo aquí junto con tu nueva contraseña.";
        mostrarFormulario("f-restablecer", true);
        anunciar($("restablecer-aviso").textContent);
      });
    });

    conectar("f-restablecer", function (f) {
      if (!valor(f, "codigo")) return { texto: "Escribe el código que te llegó al correo.", campo: campo(f, "codigo") };
      var e = errorContrasena(campo(f, "contrasena").value); if (e) return { texto: e, campo: campo(f, "contrasena") };
      if (campo(f, "contrasena").value !== campo(f, "repetir").value) return { texto: "Las dos contraseñas no son iguales.", campo: campo(f, "repetir") };
      return null;
    }, function (f) {
      return api.restablecer(correoPendiente, valor(f, "codigo"), campo(f, "contrasena").value).then(function () {
        f.reset();
        estadoCuenta("Tu contraseña cambió. Inicia sesión con la nueva.");
        anunciar($("cuenta-estado").textContent);
        mostrarFormulario("f-acceso", true);
      });
    });

    // --- Sesión abierta: cerrar sesión, borrar chats y eliminar cuenta ---
    $("cerrar-sesion").addEventListener("click", function () {
      api.cerrarSesion();
      borrarConversacion();
      estadoCuenta("Cerraste sesión. Se borró la conversación de este navegador.");
      anunciar($("cuenta-estado").textContent);
      formularioActual = "f-acceso";
      actualizarChat();
      $("titulo-cuenta").focus();
    });

    function pedirConfirmacion(opciones, quien) {
      abrioConfirmacion = quien;
      var panel = $("confirmar");
      $("confirmar-titulo").textContent = opciones.titulo;
      $("confirmar-texto").textContent = opciones.texto;
      $("confirmar-clave").hidden = !opciones.contrasena;
      $("confirmar-pass").value = "";
      $("confirmar-error").hidden = true;
      $("confirmar-error").textContent = "";
      $("confirmar-pass").removeAttribute("aria-invalid");
      $("confirmar-si").textContent = opciones.boton;
      panel.hidden = false;
      panel.alConfirmar = opciones.alConfirmar;
      panel.contrasena = !!opciones.contrasena;
      $("confirmar-titulo").focus();
    }

    $("borrar-chats").addEventListener("click", function () {
      pedirConfirmacion({
        titulo: "¿Borrar todos tus chats guardados?",
        texto: "Se borran tus preguntas y respuestas guardadas en el servidor. Tu cuenta se queda. No se puede deshacer.",
        boton: "Sí, borrar mis chats", contrasena: false,
        alConfirmar: function () {
          return api.borrarChats().then(function () {
            borrarConversacion();
            estadoCuenta("Se borraron tus chats guardados.");
            anunciar($("cuenta-estado").textContent);
          });
        }
      }, $("borrar-chats"));
    });

    $("eliminar-cuenta").addEventListener("click", function () {
      pedirConfirmacion({
        titulo: "¿Eliminar tu cuenta?",
        texto: "Se borran tu cuenta y todos tus datos y chats del servidor. No se puede deshacer. Escribe tu contraseña para confirmar.",
        boton: "Sí, eliminar mi cuenta", contrasena: true,
        alConfirmar: function (contrasena) {
          return api.eliminarCuenta(contrasena).then(function () {
            borrarConversacion();
            estadoCuenta("Tu cuenta y tus datos se eliminaron.");
            anunciar($("cuenta-estado").textContent);
            formularioActual = "f-registro";
            actualizarChat();
            $("titulo-cuenta").focus();
          });
        }
      }, $("eliminar-cuenta"));
    });

    $("confirmar-no").addEventListener("click", function () {
      $("confirmar").hidden = true;
      if (abrioConfirmacion) abrioConfirmacion.focus();
    });
    $("confirmar-si").addEventListener("click", function () {
      var panel = $("confirmar");
      var error = $("confirmar-error");
      var clave = $("confirmar-pass").value;
      if (panel.contrasena && !clave) {
        error.textContent = "Escribe tu contraseña para confirmar.";
        error.hidden = false;
        $("confirmar-pass").setAttribute("aria-invalid", "true");
        $("confirmar-pass").focus();
        return;
      }
      $("confirmar-si").setAttribute("aria-disabled", "true");
      panel.alConfirmar(clave).then(function () {
        panel.hidden = true;
      }, function (e) {
        error.textContent = e.message;
        error.hidden = false;
        error.focus();
      }).then(function () { $("confirmar-si").removeAttribute("aria-disabled"); });
    });
  }

  // ------------------------------------------------------------------ Chat
  var historial = [];
  var esperando = false;
  var audio = null;
  var relojTono = null;

  function preferencia(boton, clave, porDefecto) {
    var valor = leer(clave);
    var activo = valor === null ? porDefecto : valor === "si";
    boton.setAttribute("aria-pressed", String(activo));
    boton.addEventListener("click", function () {
      var nuevo = boton.getAttribute("aria-pressed") !== "true";
      boton.setAttribute("aria-pressed", String(nuevo));
      guardar(clave, nuevo ? "si" : "no");
      if (!nuevo && boton.id === "voz-respuestas") voz.callar();
    });
  }
  function activo(id) { return $(id).getAttribute("aria-pressed") === "true"; }

  function pitido() {
    if (!audio) return;
    var oscilador = audio.createOscillator();
    var volumen = audio.createGain();
    oscilador.type = "sine";
    oscilador.frequency.value = 523;
    volumen.gain.setValueAtTime(0.0001, audio.currentTime);
    volumen.gain.exponentialRampToValueAtTime(0.06, audio.currentTime + 0.03);
    volumen.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.25);
    oscilador.connect(volumen).connect(audio.destination);
    oscilador.start();
    oscilador.stop(audio.currentTime + 0.3);
  }
  function iniciarTono() {
    if (!activo("tono-espera")) return;
    var Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    if (!audio) audio = new Contexto();
    pitido();
    relojTono = setInterval(pitido, 3000);
  }
  function detenerTono() { clearInterval(relojTono); relojTono = null; }

  function agregarMensaje(tipo, texto, nota) {
    var etiquetas = { persona: "Tú", asistente: "Asistente", error: "Aviso" };
    var li = document.createElement("li");
    li.className = "mensaje mensaje-" + tipo;
    var quien = document.createElement("p");
    quien.className = "quien";
    quien.textContent = etiquetas[tipo] + ":";
    var cuerpo = document.createElement("p");
    cuerpo.textContent = texto;
    li.appendChild(quien);
    li.appendChild(cuerpo);
    if (nota) {
      var extra = document.createElement("p");
      extra.className = "nota";
      extra.textContent = nota;
      li.appendChild(extra);
    }
    $("mensajes").appendChild(li);
    $("chat-vacio").hidden = true;
    li.scrollIntoView({ block: "nearest" });
  }

  function contexto() {
    return historial.slice(-6).map(function (m) {
      return (m.rol === "persona" ? "Persona: " : "Asistente: ") + m.texto.slice(0, 1000);
    });
  }

  function borrarConversacion() {
    historial = [];
    $("mensajes").textContent = "";
    $("chat-vacio").hidden = false;
    voz.callar();
  }

  function mostrarError(texto) {
    var error = $("pregunta-error");
    error.textContent = texto;
    error.hidden = !texto;
    $("pregunta").setAttribute("aria-invalid", texto ? "true" : "false");
  }

  function enviar(evento) {
    evento.preventDefault();
    if (esperando) return;
    var campo = $("pregunta");
    var texto = campo.value.trim();
    if (!texto) {
      mostrarError("Escribe una pregunta antes de enviarla.");
      campo.focus();
      return;
    }
    mostrarError("");
    var previo = contexto();
    agregarMensaje("persona", texto);
    historial.push({ rol: "persona", texto: texto });
    campo.value = "";
    campo.focus();

    esperando = true;
    $("enviar").setAttribute("aria-disabled", "true");
    $("mensajes").setAttribute("aria-busy", "true");
    anunciar("Pregunta enviada. Esperando respuesta.");
    var avisoDespertar = setTimeout(function () {
      var aviso = "El servidor está despertando. Puede tardar cerca de un minuto.";
      estado(aviso);
      anunciar(aviso);
      iniciarTono();
    }, config.avisoDespertarMs);

    api.preguntar(texto, previo).then(function (datos) {
      var nota = datos.hayMas ? "Si quieres una explicación más larga, pídela." : null;
      agregarMensaje("asistente", datos.respuesta, nota);
      historial.push({ rol: "asistente", texto: datos.respuesta });
      anunciar("Respuesta del asistente: " + datos.respuesta + (nota ? " " + nota : ""));
      if (activo("voz-respuestas")) voz.decir(datos.respuesta);
    }, function (error) {
      agregarMensaje("error", error.message);
      anunciar("Aviso: " + error.message);
    }).then(function () {
      clearTimeout(avisoDespertar);
      detenerTono();
      if (api.configurado()) estado("");
      esperando = false;
      $("enviar").removeAttribute("aria-disabled");
      $("mensajes").removeAttribute("aria-busy");
      actualizarChat();
    });
  }

  function prepararChat() {
    preferencia($("voz-respuestas"), "cecapi.vozRespuestas", false);
    preferencia($("tono-espera"), "cecapi.tono", true);
    if (!voz.disponible) {
      $("voz-respuestas").disabled = true;
      $("voz-respuestas").textContent = "Voz no disponible en este navegador";
    }
    $("formulario").addEventListener("submit", enviar);
    $("pregunta").addEventListener("keydown", function (e) {
      // Enter envía; Mayúsculas + Enter hace salto de línea.
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) $("formulario").requestSubmit();
    });
    $("borrar").addEventListener("click", function () {
      borrarConversacion();
      anunciar("Se borró la conversación.");
      $("pregunta").focus();
    });
  }

  // ------------------------------------------------------------------ Arranque
  var asistenteListo = false;
  function mostrarAsistente(conFoco) {
    if (!asistenteListo) {
      asistenteListo = true;
      prepararCuenta();
      prepararChat();
    }
    $("cuenta").hidden = false;
    actualizarChat();
    if (conFoco) {
      var destino = $("chat").hidden ? $("titulo-cuenta") : $("pregunta");
      if (destino.tagName === "H2") destino.setAttribute("tabindex", "-1");
      destino.focus();
    }
  }

  // Despierta al servidor en cuanto se abre la página, mientras la persona lee.
  function calentar() {
    if (!api.configurado()) {
      estado("El servidor del asistente todavía no está configurado, así que por ahora no puede responder.");
      return;
    }
    var avisado = false;
    var reloj = setTimeout(function () {
      avisado = true;
      estado("El asistente se está preparando. Puede tardar cerca de un minuto.");
    }, config.avisoDespertarMs);
    api.salud().then(function () {
      clearTimeout(reloj);
      if (avisado) estado("El asistente está listo.");
    }, function (error) {
      clearTimeout(reloj);
      if (avisado) estado(error.message);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    calentar();
    prepararPoliticas();
    cargarPoliticas().then(function () {
      if (aceptacionVigente()) { mostrarAsistente(false); return; }
      mostrarPoliticas();
      mostrarParte(0, false);
    }, function () {
      $("sin-aceptar-motivo").textContent = "No se pudieron cargar las políticas. Revisa tu conexión y recarga la página.";
      $("volver-politicas").hidden = true;
      $("sin-aceptar").hidden = false;
    });
  });
})();
