// Panel de descargas. Lee datos/descargas.v1.json, que se actualiza a mano en cada versión publicada
// en GitHub Releases (ver README). Todo se inserta como texto, nunca como HTML.
(function () {
  "use strict";

  function tamano(bytes) {
    if (!bytes) return "sin dato";
    return (bytes / 1048576).toLocaleString("es-MX", { maximumFractionDigits: 1 }) + " MB";
  }

  function elemento(etiqueta, texto, clase) {
    var el = document.createElement(etiqueta);
    if (texto) el.textContent = texto;
    if (clase) el.className = clase;
    return el;
  }

  function seguro(url) {
    try { return new URL(url).protocol === "https:"; } catch (e) { return false; }
  }

  function tarjeta(app) {
    var seccion = elemento("section", null, "descarga");
    seccion.setAttribute("aria-labelledby", "titulo-" + app.id);
    var titulo = elemento("h2", app.plataforma);
    titulo.id = "titulo-" + app.id;
    seccion.appendChild(titulo);

    if (!app.version || !app.url || !seguro(app.url)) {
      seccion.appendChild(elemento("p", "Todavía no hay una versión publicada para " + app.plataforma + "."));
      if (app.requisitos) seccion.appendChild(elemento("p", "Requisitos: " + app.requisitos));
      return seccion;
    }

    var datos = elemento("dl", null, "datos");
    [["Versión", app.version], ["Tamaño", tamano(app.tamanoBytes)], ["Requisitos", app.requisitos],
     ["Archivo", app.archivo], ["SHA-256", app.sha256 || "sin dato"]].forEach(function (par) {
      if (!par[1]) return;
      datos.appendChild(elemento("dt", par[0]));
      datos.appendChild(elemento("dd", par[1], par[0] === "SHA-256" ? "suma" : null));
    });
    seccion.appendChild(datos);

    var enlace = elemento("a", "Descargar " + app.nombre + ", versión " + app.version + " (" + tamano(app.tamanoBytes) + ")", "boton boton-principal");
    enlace.href = app.url;
    var p = elemento("p");
    p.appendChild(enlace);
    seccion.appendChild(p);
    return seccion;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var lista = document.getElementById("lista-descargas");
    fetch("datos/descargas.v1.json", { cache: "no-cache" })
      .then(function (res) { if (!res.ok) throw new Error(); return res.json(); })
      .then(function (datos) {
        lista.textContent = "";
        datos.apps.forEach(function (app) { lista.appendChild(tarjeta(app)); });
      })
      .catch(function () {
        lista.textContent = "";
        lista.appendChild(elemento("p", "No se pudo cargar la lista de descargas. Revisa tu conexión y recarga la página."));
      });
  });
})();
