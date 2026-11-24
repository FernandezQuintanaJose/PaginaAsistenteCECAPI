// Prueba hostil del chat: se comporta como un servidor roto o malicioso y como alguien que busca atajos.
// Comprueba que el chat nunca se queda bloqueado, que nada del servidor se interpreta como HTML,
// que el historial respeta los límites del servidor y que un localStorage manipulado no rompe la página.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { servir } from "./servidor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const PUERTO = 8111, API = "https://qa-cecapi.onrender.com";
const URL_SITIO = `http://localhost:${PUERTO}/PaginaAsistenteCECAPI/`;
const srv = await servir(PUERTO);
const nav = await chromium.launch();
const leerRepo = (ruta) => readFile(new URL("../" + ruta, import.meta.url), "utf8");
const version = (await leerRepo("politicas.html")).match(/data-version="([^"]+)"/)[1];
const cfgBase = (await leerRepo("assets/js/config.v2.js")).replace('apiBase: ""', `apiBase: "${API}"`).replace("avisoDespertarMs: 4000", "avisoDespertarMs: 300");
let hallazgos = [];
const reporta = (ok, d) => { console.log(`${ok ? "ok   " : "ROTO "} ${d}`); if (!ok) hallazgos.push(d); };

async function sesion({ resp, init, cfg } = {}) {
  const ctx = await nav.newContext();
  await ctx.route("**/assets/js/config.v2.js", (r) => r.fulfill({ contentType: "text/javascript", body: cfg || cfgBase }));
  const recibidas = [];
  await ctx.route(`${API}/**`, async (r) => {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE" };
    const m = r.request().method();
    if (m === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    if (m === "GET") return r.fulfill({ headers: cors, json: { status: "ok" } });
    recibidas.push(r.request().postData());
    const x = typeof resp === "function" ? resp(recibidas.length) : resp;
    if (x.espera) await new Promise((o) => setTimeout(o, x.espera));
    return r.fulfill({ status: x.status ?? 200, headers: { ...cors, "Content-Type": x.tipo ?? "application/json" }, body: x.crudo ?? JSON.stringify(x.body) });
  });
  await ctx.addInitScript(({ v, init }) => {
    if (!sessionStorage.getItem("__ya")) {
      sessionStorage.setItem("__ya", "1");
      localStorage.setItem("cecapi.politicas", JSON.stringify({ version: v, fecha: new Date().toISOString(), mayorDeEdad: true }));
    }
    if (init) (0, eval)(init);
  }, { v: version, init });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(URL_SITIO, { waitUntil: "networkidle" });
  return { p, ctx, errs, recibidas };
}
const preguntar = async (p, t) => { await p.fill("#pregunta", t); await p.press("#pregunta", "Enter"); };
const libre = async (p, ms = 3000) => p.waitForFunction(() => document.getElementById("enviar").getAttribute("aria-disabled") !== "true", null, { timeout: ms }).then(() => true, () => false);

// --- Rol: servidor hostil / roto
const casos = {
  "200 con cuerpo no JSON (HTML de un proxy o portal WiFi)": { status: 200, tipo: "text/html", crudo: "<html>Bienvenido al WiFi</html>" },
  "200 sin campo respuesta": { body: { proveedor: "x" } },
  "200 con respuesta numerica": { body: { respuesta: 42 } },
  "200 con respuesta objeto": { body: { respuesta: { a: 1 } } },
  "200 con respuesta null": { body: { respuesta: null } },
};
for (const [nombre, resp] of Object.entries(casos)) {
  const { p, errs } = await sesion({ resp });
  await preguntar(p, "hola");
  const ok1 = await libre(p, 2500);
  reporta(ok1, `servidor hostil: ${nombre} -> el chat se libera`);
  if (ok1) {
    await preguntar(p, "segunda"); await p.waitForTimeout(500);
    const n = await p.locator("#mensajes li").count();
    reporta(n >= 3 && errs.length === 0, `servidor hostil: ${nombre} -> sigue usable (mensajes=${n}, errores JS=${errs.length})`);
  } else reporta(false, `   detalle: errores JS = ${JSON.stringify(errs.slice(0, 2))}; boton sigue bloqueado`);
  await p.context().close();
}
// XSS
{
  const pay = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  const { p } = await sesion({ resp: { body: { respuesta: pay, hayMas: false } } });
  await preguntar(p, pay); await libre(p); await p.waitForTimeout(300);
  reporta(!(await p.evaluate(() => window.__xss)) && (await p.locator("#mensajes img").count()) === 0, "XSS: HTML en pregunta y respuesta se muestra como texto");
  await p.context().close();
}
// Respuesta gigante
{
  const { p } = await sesion({ resp: { body: { respuesta: "a ".repeat(750000) } } });
  const t0 = Date.now(); await preguntar(p, "grande"); const ok = await libre(p, 8000);
  reporta(ok, `respuesta de 1.5 MB no congela el navegador (${Date.now() - t0} ms)`); await p.context().close();
}
for (const [n, r] of [["500 HTML", { status: 500, tipo: "text/html", crudo: "<h1>boom</h1>" }], ["429", { status: 429, body: { detail: "Demasiadas" } }], ["422 sin detail", { status: 422, body: { x: 1 } }], ["401 al preguntar", { status: 401, body: {} }]]) {
  const { p } = await sesion({ resp: r }); await preguntar(p, "hola"); const ok = await libre(p, 2500);
  const txt = (await p.locator("#mensajes li").last().textContent().catch(() => "")).trim();
  reporta(ok && txt.length > 5, `error ${n}: se libera y avisa -> "${txt.slice(0, 70)}"`); await p.context().close();
}
// --- Rol: jugador que busca atajos
{
  const { p, recibidas } = await sesion({ resp: { espera: 1200, body: { respuesta: "ok" } } });
  await p.fill("#pregunta", "spam");
  for (let i = 0; i < 25; i++) await p.press("#pregunta", "Enter");
  await p.click("#enviar", { force: true, clickCount: 5 }).catch(() => {});
  await p.waitForTimeout(2200);
  reporta(recibidas.length === 1, `spam de Enter/clics: solo 1 peticion enviada (fueron ${recibidas.length})`);
  await p.fill("#pregunta", "   \n\t  "); await p.press("#pregunta", "Enter");
  reporta(await p.locator("#pregunta-error").isVisible(), "solo espacios: pide escribir algo");
  const n0 = recibidas.length;
  await p.fill("#pregunta", "x".repeat(2000)); await p.press("#pregunta", "Enter"); await libre(p, 3000);
  const cuerpo = JSON.parse(recibidas[recibidas.length - 1] || "{}");
  reporta(recibidas.length === n0 + 1 && cuerpo.pregunta.length === 2000, "pregunta de 2000 caracteres se envia completa");
  await p.context().close();
}
{
  const { p, recibidas } = await sesion({ resp: { body: { respuesta: "r".repeat(3000), conversacionId: "c1" } } });
  for (let i = 0; i < 6; i++) { await preguntar(p, "p" + i + "z".repeat(1500)); await libre(p, 3000); }
  const c = JSON.parse(recibidas[recibidas.length - 1]);
  reporta(c.contexto.length <= 6 && c.contexto.every((x) => x.length < 1100), `contexto acotado: ${c.contexto.length} lineas, max ${Math.max(...c.contexto.map((x) => x.length))} caracteres`);
  await p.context().close();
}
// --- Rol: manipulador de localStorage
const malos = [["JSON roto", "{"], ["null", "null"], ["arreglo", "[]"], ["version vieja", JSON.stringify({ version: "0", mayorDeEdad: true })], ["mayorDeEdad como texto", JSON.stringify({ version, mayorDeEdad: "true" })], ["__proto__", '{"__proto__":{"mayorDeEdad":true},"version":"' + version + '"}']];
for (const [n, v] of malos) {
  const { p, errs } = await sesion({ resp: { body: { respuesta: "ok" } }, init: `localStorage.setItem("cecapi.politicas", ${JSON.stringify(v)})` });
  const pol = await p.isVisible("#politicas"), chat = await p.isVisible("#chat");
  reporta(!errs.length && pol && !chat, `localStorage "${n}": exige politicas otra vez (politicas=${pol}, chat=${chat}, errores=${errs.length})`);
  await p.context().close();
}
{
  const { p, errs } = await sesion({ resp: { body: { respuesta: "ok" } }, init: `Object.defineProperty(window,"localStorage",{get(){throw new DOMException("bloqueado","SecurityError")}})` });
  reporta(!errs.length && await p.isVisible("#politicas"), `localStorage bloqueado: la pagina no se rompe (errores=${errs.length})`);
  await p.context().close();
}
{
  const { p, ctx } = await sesion({ resp: { espera: 600, body: { respuesta: "ok" } } });
  await preguntar(p, "hola"); await ctx.setOffline(true); await libre(p, 5000); await ctx.setOffline(false);
  reporta(await libre(p, 2000), "se cae el internet a mitad: el chat se libera"); await ctx.close();
}
// --- Rol: texto raro, servidor caido y cierre a mitad de respuesta
{
  const { p, recibidas, errs } = await sesion({ resp: { body: { respuesta: "ok" } } });
  await p.focus("#pregunta");
  await p.keyboard.insertText("x".repeat(100000));
  const largo = (await p.inputValue("#pregunta")).length;
  reporta(largo <= 2000 && errs.length === 0, `texto enorme pegado (100000): el campo se queda en ${largo} caracteres y no hay errores`);
  await p.press("#pregunta", "Enter"); await libre(p, 3000);
  reporta(recibidas.length === 1 && JSON.parse(recibidas[0]).pregunta.length <= 2000, "texto enorme: lo que sale nunca pasa de 2000 caracteres");
  await p.context().close();
}
{
  const emojis = "\u{1F600}\u{1F44D}\u{1F9D1}‍\u{1F9AF}\u{1F1F2}\u{1F1FD}";
  const { p, errs, recibidas } = await sesion({ resp: { body: { respuesta: emojis + " listo" } } });
  await preguntar(p, "hola " + emojis); await libre(p, 3000);
  reporta(recibidas.length === 1 && JSON.parse(recibidas[0]).pregunta.includes(emojis) && errs.length === 0, "emojis y secuencias raras: se envian completos y no hay errores");
  reporta((await p.locator("#mensajes li").last().textContent()).includes("listo"), "emojis en la respuesta: se muestran");
  await p.context().close();
}
{
  const { p, ctx, errs } = await sesion({ resp: { body: { respuesta: "ok" } } });
  await ctx.route(`${API}/preguntar`, (r) => r.abort("connectionrefused"));
  await preguntar(p, "hola"); const ok = await libre(p, 3000);
  const txt = (await p.locator("#mensajes li").last().textContent().catch(() => "")).trim();
  reporta(ok && /conectar|conexi/i.test(txt) && errs.length === 0, `servidor caido (conexion rechazada): se libera y avisa -> "${txt.slice(0, 70)}"`);
  await ctx.close();
}
{
  const { p, ctx, errs } = await sesion({ resp: { espera: 5000, body: { respuesta: "tarde" } } });
  await preguntar(p, "hola"); await p.waitForTimeout(300);
  await p.reload({ waitUntil: "networkidle" });
  reporta(errs.length === 0 && await p.isVisible("#chat"), `recargar a mitad de respuesta: el chat abre sin errores (errores=${errs.length})`);
  reporta((await p.locator("#mensajes li").count()) <= 1, "recargar a mitad de respuesta: no queda guardada la conversacion (privacidad)");
  await ctx.close();
}
await nav.close(); srv.close();
console.log("\nHALLAZGOS:", hallazgos.length); hallazgos.forEach((h) => console.log(" -", h)); process.exit(hallazgos.length ? 1 : 0);
