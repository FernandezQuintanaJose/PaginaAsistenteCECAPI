// Página del asistente: políticas por partes, cuenta de Google y chat.
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
  function estadoCuenta(texto) { $("cuenta-estado").textContent = texto; }

  function chatPermitido() { return config.permitirSinCuenta || api.conSesion(); }

  function actualizarChat() {
    var permitido = chatPermitido();
    $("chat").hidden = !permitido;
    if (!permitido) estadoCuenta("Inicia sesión con Google para usar el asistente.");
  }

  function alRecibirCredencial(respuesta) {
    if (!config.rutas.sesion) {
      estadoCuenta("El servidor todavía no acepta cuentas." +
        (config.permitirSinCuenta ? " Puedes seguir usando el asistente sin cuenta." : ""));
      return;
    }
    estadoCuenta("Iniciando sesión.");
    api.iniciarSesion(respuesta.credential).then(function (datos) {
      estadoCuenta("Sesión iniciada" + (datos.nombre ? " como " + datos.nombre : "") + ".");
      $("boton-google").hidden = true;
      $("cerrar-sesion").hidden = false;
      var registro = aceptacionVigente();
      if (registro) api.registrarAceptacion(registro).catch(function () {});
      actualizarChat();
      $("cerrar-sesion").focus();
    }, function (error) {
      estadoCuenta(error.message);
    });
  }

  function prepararCuenta() {
    $("cuenta").hidden = false;
    if (!config.googleClientId) {
      estadoCuenta("El inicio de sesión con Google todavía no está disponible." +
        (config.permitirSinCuenta ? " Mientras tanto puedes usar el asistente sin cuenta." : ""));
      return;
    }
    estadoCuenta(config.permitirSinCuenta
      ? "Puedes usar el asistente sin cuenta o iniciar sesión con Google."
      : "Inicia sesión con Google para usar el asistente.");
    var script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = function () {
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: alRecibirCredencial,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      window.google.accounts.id.renderButton($("boton-google"), {
        type: "standard", theme: "outline", size: "large", text: "signin_with", locale: "es-419"
      });
    };
    script.onerror = function () { estadoCuenta("No se pudo cargar el inicio de sesión de Google. Revisa tu conexión."); };
    document.head.appendChild(script);

    $("cerrar-sesion").addEventListener("click", function () {
      api.cerrarSesion();
      if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect();
      borrarConversacion();
      $("cerrar-sesion").hidden = true;
      $("boton-google").hidden = false;
      estadoCuenta("Cerraste sesión. Se borró la conversación de este navegador.");
      actualizarChat();
      $("titulo-cuenta").setAttribute("tabindex", "-1");
      $("titulo-cuenta").focus();
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
