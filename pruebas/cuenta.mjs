// Prueba de la cuenta (usuario o correo y contraseña) con un servidor simulado.
// Cubre registro con código, acceso por correo y por usuario, recuperar contraseña,
// borrar chats, eliminar cuenta, validaciones y que no se use Google.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { servir } from "./servidor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = require.resolve("axe-core/axe.min.js");
const PUERTO = 8093;
const SITIO = `http://localhost:${PUERTO}/PaginaAsistenteCECAPI/`;
const API = "https://prueba-cecapi.onrender.com";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept", "Access-Control-Allow-Methods": "GET,POST,DELETE" };

let fallas = 0;
const revisar = (ok, d) => { console.log(`${ok ? "bien " : "FALLA"} ${d}`); if (!ok) fallas++; };

const configBase = await readFile(new URL("../assets/js/config.v2.js", import.meta.url), "utf8");
function configurar(texto, { verificacion = true } = {}) {
  let t = texto.replace('apiBase: ""', `apiBase: "${API}"`).replace("avisoDespertarMs: 4000", "avisoDespertarMs: 30000");
  for (const r of ["registro", "verificar", "acceso", "recuperar", "restablecer", "aceptacion", "borrarChats", "eliminarCuenta"]) {
    t = t.replace(new RegExp(`${r}: null`), `${r}: "/cuenta/${r}"`);
  }
  return t.replace("verificacionPorCorreo: true", `verificacionPorCorreo: ${verificacion}`);
}

function servidorSimulado({ verificacion = true } = {}) {
  const estado = { usuarios: {}, pendientes: {}, llamadas: [] };
  const CODIGO = "123456";
  async function manejar(r) {
    const pet = r.request();
    if (pet.method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    const ruta = new URL(pet.url()).pathname;
    const datos = pet.postData() ? pet.postDataJSON() : {};
    estado.llamadas.push({ metodo: pet.method(), ruta, datos, auth: pet.headers()["authorization"] || null });
    const ok = (json) => r.fulfill({ status: 200, headers: CORS, json });
    const error = (status, detail) => r.fulfill({ status, headers: CORS, json: { detail } });
    if (ruta === "/") return ok({ status: "ok" });
    if (ruta === "/preguntar") return ok({ respuesta: "Respuesta de prueba.", proveedor: "groq", hayMas: false });
    if (ruta === "/cuenta/registro") {
      if (estado.usuarios[datos.usuario]) return error(409, "Ese nombre de usuario ya existe.");
      estado.pendientes[datos.correo] = datos;
      if (!verificacion) { estado.usuarios[datos.usuario] = { correo: datos.correo, contrasena: datos.contrasena }; }
      return ok({ requiereCodigo: verificacion });
    }
    if (ruta === "/cuenta/verificar") {
      const p = estado.pendientes[datos.correo];
      if (!p || datos.codigo !== CODIGO) return error(400, "El código no es correcto.");
      estado.usuarios[p.usuario] = { correo: p.correo, contrasena: p.contrasena };
      return ok({ token: "token-" + p.usuario, usuario: p.usuario });
    }
    if (ruta === "/cuenta/acceso") {
      const nombre = Object.keys(estado.usuarios).find((u) => u === datos.identificador || estado.usuarios[u].correo === datos.identificador);
      if (!nombre || estado.usuarios[nombre].contrasena !== datos.contrasena) return error(401, "Usuario o contraseña incorrectos.");
      return ok({ token: "token-" + nombre, usuario: nombre });
    }
    if (ruta === "/cuenta/recuperar") return ok({});
    if (ruta === "/cuenta/restablecer") {
      const nombre = Object.keys(estado.usuarios).find((u) => estado.usuarios[u].correo === datos.correo);
      if (datos.codigo !== CODIGO || !nombre) return error(400, "El código no es correcto.");
      estado.usuarios[nombre].contrasena = datos.contrasena;
      return ok({});
    }
    if (ruta === "/cuenta/aceptacion") return ok({});
    if (ruta === "/cuenta/borrarChats") return ok({});
    if (ruta === "/cuenta/eliminarCuenta") {
      const nombre = Object.keys(estado.usuarios).find((u) => "token-" + u === (pet.headers()["authorization"] || "").replace("Bearer ", ""));
      if (!nombre || estado.usuarios[nombre].contrasena !== datos.contrasena) return error(403, "La contraseña no es correcta.");
      delete estado.usuarios[nombre];
      return ok({});
    }
    return error(404, "No existe.");
  }
  return { estado, manejar };
}

const servidor = await servir(PUERTO);
const navegador = await chromium.launch();
const peticionesGoogle = [];

async function abrir(opciones = {}) {
  const sim = servidorSimulado(opciones);
  const contexto = await navegador.newContext({ bypassCSP: opciones.bypassCSP === true });
  await contexto.route("**/assets/js/config.v2.js", (r) => r.fulfill({ contentType: "text/javascript", body: configurar(configBase, opciones) }));
  await contexto.route(`${API}/**`, sim.manejar);
  const pagina = await contexto.newPage();
  pagina.on("request", (p) => { if (p.url().includes("google")) peticionesGoogle.push(p.url()); });
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(e.message));
  await pagina.goto(SITIO, { waitUntil: "networkidle" });
  return { pagina, sim, contexto, errores };
}

async function aceptarPoliticas(p) {
  const total = Number((await p.textContent("#politica-progreso")).match(/de (\d+)/)[1]);
  for (let i = 1; i < total; i++) await p.click("#politica-siguiente");
  await p.check("#politica-edad");
  await p.click("#politica-aceptar");
}
const texto = async (p, sel) => (await p.textContent(sel)).trim();
const foco = (p) => p.evaluate(() => document.activeElement.id || document.activeElement.tagName);

// ------------------------------------------------------------------ con correo
let { pagina: p, sim, errores } = await abrir();
await aceptarPoliticas(p);
revisar(await p.isHidden("#chat"), "con cuentas disponibles el chat espera el inicio de sesión");
revisar(await p.isVisible("#f-acceso") && await p.isVisible("#cuenta-modos"), "se ve el formulario de acceso y los modos");
revisar(await p.isVisible("#ir-recuperar"), "con verificación por correo se ofrece recuperar la contraseña");
revisar((await p.locator("#acc-id").evaluate((e) => e.autocomplete)) === "username" && (await p.getAttribute("#acc-pass", "autocomplete")) === "current-password", "los campos de acceso tienen autocompletado correcto");

await p.click("#acc-mostrar");
revisar((await p.getAttribute("#acc-pass", "type")) === "text", "Mostrar contraseña revela el campo");
await p.click("#acc-mostrar");
revisar((await p.getAttribute("#acc-pass", "type")) === "password", "y lo vuelve a ocultar");

await p.click('[data-modo="f-registro"]');
revisar(await foco(p) === "H3" && await p.isVisible("#f-registro"), "Crear cuenta abre el formulario y lleva el foco a su título");

const registroError = async (esperado, idCampo, descripcion) => {
  await p.click("#f-registro button[type=submit]");
  const t = await texto(p, "#f-registro .error");
  revisar(t.includes(esperado) && (await foco(p)) === idCampo && (await p.getAttribute("#" + idCampo, "aria-invalid")) === "true", descripcion);
};
await registroError("nombre de usuario", "reg-usuario", "usuario vacío: error y foco en el campo");
await p.fill("#reg-usuario", "ñoño");
await registroError("nombre de usuario", "reg-usuario", "usuario con acentos o eñe: rechazado");
await p.fill("#reg-usuario", "maria.lopez");
await registroError("correo válido", "reg-correo", "correo vacío: error");
await p.fill("#reg-correo", "maria@correo");
await registroError("correo válido", "reg-correo", "correo sin dominio: error");
await p.fill("#reg-correo", "maria@correo.com");
await p.fill("#reg-pass", "corta");
await registroError("al menos 15", "reg-pass", "contraseña corta: error");
await p.fill("#reg-pass", "mi frase muy larga 2026");
await p.fill("#reg-pass2", "otra cosa distinta");
await registroError("no son iguales", "reg-pass2", "contraseñas distintas: error");
await p.fill("#reg-pass2", "mi frase muy larga 2026");
await registroError("18 años", "reg-mayor", "sin declarar 18+: error");
await p.check("#reg-mayor");
await p.click("#f-registro button[type=submit]");
await p.waitForSelector("#f-codigo:not([hidden])");
revisar((await texto(p, "#codigo-aviso")).includes("maria@correo.com"), "pide el código y dice a qué correo se envió");
revisar(await foco(p) === "H3", "el foco va al título del paso del código");
const llamadaRegistro = sim.estado.llamadas.find((l) => l.ruta === "/cuenta/registro");
revisar(llamadaRegistro && llamadaRegistro.datos.mayorDeEdad === true && !!llamadaRegistro.datos.version && llamadaRegistro.datos.contrasena === "mi frase muy larga 2026", "el registro manda usuario, correo, contraseña, mayoría de edad y versión de políticas");

await p.click("#f-codigo button[type=submit]");
revisar((await texto(p, "#f-codigo .error")).includes("código"), "código vacío: error");
await p.fill("#cod-codigo", "000000");
await p.click("#f-codigo button[type=submit]");
await p.waitForFunction(() => document.querySelector("#f-codigo .error").textContent.includes("no es correcto"));
revisar(true, "código incorrecto: muestra el mensaje del servidor");
await p.fill("#cod-codigo", "123456");
await p.click("#f-codigo button[type=submit]");
await p.waitForSelector("#cuenta-sesion:not([hidden])");
revisar(await p.isVisible("#chat") && (await texto(p, "#cuenta-estado")) === "Sesión iniciada como maria.lopez.", "con el código correcto inicia sesión y aparece el chat");
revisar(await foco(p) === "pregunta", "el foco queda en el campo de pregunta");
const acept = sim.estado.llamadas.find((l) => l.ruta === "/cuenta/aceptacion");
revisar(acept && acept.datos.mayorDeEdad === true && !!acept.datos.version && !!acept.datos.fecha && acept.auth === "Bearer token-maria.lopez", "registra la aceptación con fecha y versión usando el token");

await p.fill("#pregunta", "Hola");
await p.press("#pregunta", "Enter");
await p.waitForSelector(".mensaje-asistente");
const pregunta = sim.estado.llamadas.find((l) => l.ruta === "/preguntar");
revisar(pregunta.auth === "Bearer token-maria.lopez", "las preguntas llevan el token de la sesión");

// borrar chats
await p.click("#borrar-chats");
revisar(await p.isVisible("#confirmar") && await foco(p) === "confirmar-titulo", "Borrar chats pide confirmación y lleva el foco");
await p.click("#confirmar-no");
revisar(await p.isHidden("#confirmar") && await foco(p) === "borrar-chats", "Cancelar devuelve el foco al botón");
await p.click("#borrar-chats");
await p.click("#confirmar-si");
await p.waitForFunction(() => document.getElementById("cuenta-estado").textContent.includes("Se borraron tus chats"));
revisar(sim.estado.llamadas.some((l) => l.metodo === "DELETE" && l.ruta === "/cuenta/borrarChats" && l.auth === "Bearer token-maria.lopez"), "borrar chats llama al servidor con el token");
revisar((await p.locator(".mensaje").count()) === 0, "y vacía la conversación en pantalla");

// cerrar sesión y volver a entrar con correo y con usuario
await p.click("#cerrar-sesion");
revisar(await p.isHidden("#chat") && await p.isVisible("#f-acceso"), "cerrar sesión oculta el chat y vuelve al acceso");
await p.fill("#acc-id", "maria@correo.com");
await p.fill("#acc-pass", "contraseña equivocada!!");
await p.click("#f-acceso button[type=submit]");
await p.waitForFunction(() => document.querySelector("#f-acceso .error").textContent.includes("incorrectos"));
revisar(true, "contraseña equivocada: muestra el error del servidor");
await p.fill("#acc-pass", "mi frase muy larga 2026");
await p.click("#f-acceso button[type=submit]");
await p.waitForSelector("#cuenta-sesion:not([hidden])");
revisar(true, "entra con el correo");
await p.click("#cerrar-sesion");
await p.fill("#acc-id", "maria.lopez");
await p.fill("#acc-pass", "mi frase muy larga 2026");
await p.click("#f-acceso button[type=submit]");
await p.waitForSelector("#cuenta-sesion:not([hidden])");
revisar(true, "entra con el nombre de usuario");
await p.click("#cerrar-sesion");

// recuperar contraseña
await p.click("#ir-recuperar");
revisar(await p.isVisible("#f-recuperar"), "Olvidé mi contraseña abre el formulario");
await p.fill("#rec-correo", "nadie@correo.com");
await p.click("#f-recuperar button[type=submit]");
await p.waitForSelector("#f-restablecer:not([hidden])");
revisar((await texto(p, "#restablecer-aviso")).startsWith("Si ese correo tiene una cuenta"), "el aviso es el mismo exista o no el correo");
await p.fill("#res-codigo", "123456");
await p.fill("#res-pass", "esta es otra frase larga 99");
await p.fill("#res-pass2", "esta es otra frase larga 99");
await p.click("#f-restablecer button[type=submit]");
await p.waitForFunction(() => document.querySelector("#f-restablecer .error").textContent.includes("no es correcto"));
revisar(true, "con un correo sin cuenta el restablecimiento falla");
await p.click('#f-restablecer [data-ir="f-acceso"]');
await p.click("#ir-recuperar");
await p.fill("#rec-correo", "maria@correo.com");
await p.click("#f-recuperar button[type=submit]");
await p.waitForSelector("#f-restablecer:not([hidden])");
await p.fill("#res-codigo", "123456");
await p.fill("#res-pass", "esta es otra frase larga 99");
await p.fill("#res-pass2", "esta es otra frase larga 99");
await p.click("#f-restablecer button[type=submit]");
await p.waitForSelector("#f-acceso:not([hidden])");
revisar((await texto(p, "#cuenta-estado")).includes("contraseña cambió"), "restablecer cambia la contraseña y vuelve al acceso");
await p.fill("#acc-id", "maria.lopez");
await p.fill("#acc-pass", "esta es otra frase larga 99");
await p.click("#f-acceso button[type=submit]");
await p.waitForSelector("#cuenta-sesion:not([hidden])");
revisar(true, "entra con la contraseña nueva");

// eliminar cuenta
await p.click("#eliminar-cuenta");
await p.click("#confirmar-si");
revisar((await p.getAttribute("#confirmar-pass", "aria-invalid")) === "true" && (await foco(p)) === "confirmar-pass", "eliminar la cuenta exige la contraseña");
await p.fill("#confirmar-pass", "no es esta contraseña");
await p.click("#confirmar-si");
await p.waitForFunction(() => document.getElementById("confirmar-error").textContent.includes("no es correcta"));
revisar(await p.isVisible("#cuenta-sesion"), "con contraseña incorrecta no se elimina");
await p.fill("#confirmar-pass", "esta es otra frase larga 99");
await p.click("#confirmar-si");
await p.waitForFunction(() => document.getElementById("cuenta-estado").textContent.includes("se eliminaron"));
revisar(Object.keys(sim.estado.usuarios).length === 0 && await p.isHidden("#chat") && await p.isVisible("#f-registro"), "eliminar la cuenta la borra, cierra la sesión y ofrece crear otra");

revisar(peticionesGoogle.length === 0, "no se hace ninguna petición a Google");
revisar(errores.length === 0, "sin errores de JavaScript");
errores.forEach((e) => console.log("   - " + e));

// ------------------------------------------------------------------ sin correo
({ pagina: p, sim, errores } = await abrir({ verificacion: false }));
await aceptarPoliticas(p);
revisar(await p.isHidden("#ir-recuperar"), "sin verificación por correo no se ofrece recuperar contraseña");
await p.click('[data-modo="f-registro"]');
await p.fill("#reg-usuario", "luis_perez");
await p.fill("#reg-correo", "luis@correo.com");
await p.fill("#reg-pass", "otra frase suficientemente larga");
await p.fill("#reg-pass2", "otra frase suficientemente larga");
await p.check("#reg-mayor");
await p.click("#f-registro button[type=submit]");
await p.waitForSelector("#f-acceso:not([hidden])");
revisar((await texto(p, "#cuenta-estado")).includes("cuenta se creó") && await p.isHidden("#f-codigo"), "sin verificación: crea la cuenta y pasa al acceso sin pedir código");

// ------------------------------------------------------------------ cuentas aún no disponibles
const ctx2 = await navegador.newContext();
await ctx2.route("**/assets/js/config.v2.js", (r) => r.fulfill({ contentType: "text/javascript", body: configBase.replace('apiBase: ""', `apiBase: "${API}"`) }));
await ctx2.route(`${API}/**`, (r) => r.fulfill({ headers: CORS, json: {} }));
const p2 = await ctx2.newPage();
await p2.goto(SITIO, { waitUntil: "networkidle" });
await aceptarPoliticas(p2);
revisar(await p2.isVisible("#chat") && (await texto(p2, "#cuenta-estado")).includes("todavía no están disponibles"), "sin rutas de cuenta: avisa y deja usar el chat (permitirSinCuenta)");
revisar(await p2.isHidden("#cuenta-modos"), "y no muestra formularios que no funcionarían");

// ------------------------------------------------------------------ accesibilidad con los formularios abiertos
const { pagina: pa } = await abrir({ bypassCSP: true });
await aceptarPoliticas(pa);
await pa.addScriptTag({ path: AXE });
for (const modo of ["f-acceso", "f-registro", "f-recuperar"]) {
  await pa.click(`[data-modo="${modo}"]`);
  const axe = await pa.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }));
  revisar(axe.violations.length === 0, `axe sin fallas en ${modo}`);
  axe.violations.forEach((v) => console.log(`   - ${v.id}: ${v.help} (${v.nodes.length})`));
}

await navegador.close();
servidor.close();
process.exit(fallas ? 1 : 0);
