// Prueba del flujo del asistente con un servidor de IA simulado (no llama a la IA real):
// políticas por partes, requisitos para aceptar, chat, aviso de servidor despertando y errores.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { servir } from "./servidor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = require.resolve("axe-core/axe.min.js");
const PUERTO = 8092;
const URL_SITIO = `http://localhost:${PUERTO}/PaginaAsistenteCECAPI/`;
const API = "https://prueba-cecapi.onrender.com";

let fallas = 0;
function revisar(condicion, descripcion) {
  console.log(`${condicion ? "bien " : "FALLA"} ${descripcion}`);
  if (!condicion) fallas++;
}

const servidor = await servir(PUERTO);
const navegador = await chromium.launch();
const contexto = await navegador.newContext({ bypassCSP: false });
const config = (await readFile(new URL("../assets/js/config.v2.js", import.meta.url), "utf8"))
  .replace('apiBase: ""', `apiBase: "${API}"`)
  .replace("avisoDespertarMs: 4000", "avisoDespertarMs: 300");
await contexto.route("**/assets/js/config.v2.js", (r) => r.fulfill({ contentType: "text/javascript", body: config }));

let respuestaSimulada = { status: 200, body: { respuesta: "Louis Braille inventó el sistema de lectura con puntos.", proveedor: "groq", hayMas: true }, espera: 800 };
const recibidas = [];
await contexto.route(`${API}/**`, async (r) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST" };
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
  if (r.request().url().endsWith("/")) return r.fulfill({ headers: cors, json: { status: "CECAPI backend activo", proveedores: ["groq"] } });
  recibidas.push(r.request().postDataJSON());
  await new Promise((ok) => setTimeout(ok, respuestaSimulada.espera));
  return r.fulfill({ status: respuestaSimulada.status, headers: cors, json: respuestaSimulada.body });
});

const pagina = await contexto.newPage();
const errores = [];
pagina.on("pageerror", (e) => errores.push(e.message));
pagina.on("console", (m) => { if (m.type() === "error" && !m.text().includes("429")) errores.push(m.text()); });
await pagina.goto(URL_SITIO, { waitUntil: "networkidle" });

revisar(await pagina.isVisible("#abrir-ajustes") && await pagina.isHidden("#panel-ajustes"), "el panel de ajustes empieza cerrado");
await pagina.click("#abrir-ajustes");
revisar(await pagina.isVisible("#panel-ajustes") && (await pagina.getAttribute("#abrir-ajustes", "aria-expanded")) === "true", "el botón abre el panel de ajustes");
const cajas = await pagina.evaluate(() => ({ panel: document.getElementById("panel-ajustes").getBoundingClientRect().bottom + window.scrollY, titulo: document.querySelector("main h1").getBoundingClientRect().top + window.scrollY }));
revisar(cajas.panel <= cajas.titulo + 1, "el panel empuja el contenido y no lo tapa");
await pagina.click("#texto-mas");
revisar((await pagina.evaluate(() => getComputedStyle(document.documentElement).fontSize)) === "20px", "Texto más grande agranda la letra");
await pagina.click('[data-tema-boton="oscuro"]');
revisar(await pagina.evaluate(() => document.documentElement.getAttribute("data-tema")) === "oscuro", "el tema oscuro se aplica");
await pagina.keyboard.press("Escape");
revisar(await pagina.isHidden("#panel-ajustes") && await pagina.evaluate(() => document.activeElement.id === "abrir-ajustes"), "Escape cierra el panel y devuelve el foco al botón");
await pagina.click("#abrir-ajustes");
await pagina.click("#politica-parte");
revisar(await pagina.isHidden("#panel-ajustes"), "tocar fuera cierra el panel");
await pagina.evaluate(() => { localStorage.clear(); });
await pagina.reload({ waitUntil: "networkidle" });
revisar(await pagina.isVisible("#politicas"), "las políticas aparecen antes del chat");
revisar(await pagina.isHidden("#chat"), "el chat está oculto sin aceptar");
revisar((await pagina.textContent("#politica-progreso")).startsWith("Parte 1 de"), "empieza en la parte 1");

await pagina.click("#politica-aceptar");
revisar((await pagina.textContent("#politica-requisito")).includes("última parte"), "no deja aceptar sin llegar al final");

const total = Number((await pagina.textContent("#politica-progreso")).match(/de (\d+)/)[1]);
for (let i = 1; i < total; i++) await pagina.click("#politica-siguiente");
revisar((await pagina.textContent("#politica-siguiente")) === "Ir a la decisión", "la última parte ofrece ir a la decisión");
revisar(await pagina.evaluate(() => document.activeElement.tagName === "H3"), "el foco va al título de cada parte");
await pagina.click("#politica-siguiente");
revisar(await pagina.evaluate(() => document.activeElement.id === "politica-edad"), "ir a la decisión lleva a la casilla de edad");

await pagina.click("#politica-aceptar");
revisar((await pagina.textContent("#politica-requisito")).includes("18 años"), "no deja aceptar sin declarar 18+");

await pagina.check("#politica-edad");
await pagina.click("#politica-aceptar");
revisar(await pagina.isVisible("#chat"), "al aceptar aparece el chat");
revisar(await pagina.evaluate(() => document.activeElement.id === "pregunta"), "el foco queda en el campo de pregunta");
const registro = await pagina.evaluate(() => JSON.parse(localStorage.getItem("cecapi.politicas")));
revisar(registro && registro.mayorDeEdad === true && !!registro.version, "se guarda la aceptación con versión y 18+");

await pagina.click("#enviar");
revisar(await pagina.isVisible("#pregunta-error"), "pregunta vacía muestra error");

await pagina.fill("#pregunta", "¿Quién fue Louis Braille?");
await pagina.press("#pregunta", "Enter");
const aviso = await pagina.waitForFunction(() => document.getElementById("estado-servidor").textContent.includes("despertando"), null, { timeout: 2000 }).catch(() => null);
revisar(!!aviso, "avisa que el servidor está despertando");
await pagina.waitForSelector(".mensaje-asistente");
revisar((await pagina.textContent(".mensaje-asistente")).includes("Louis Braille"), "muestra la respuesta");
await pagina.waitForTimeout(150);
revisar((await pagina.textContent("#anuncio")).startsWith("Respuesta del asistente"), "anuncia la respuesta al lector de pantalla");
revisar(await pagina.isHidden("#estado-servidor"), "quita el aviso al responder");

respuestaSimulada = { status: 429, body: { detail: "Hiciste muchas preguntas seguidas. Espera un minuto e intenta de nuevo." }, espera: 10 };
await pagina.fill("#pregunta", "Otra pregunta");
await pagina.click("#enviar");
await pagina.waitForSelector(".mensaje-error");
revisar((await pagina.textContent(".mensaje-error")).includes("muchas preguntas"), "muestra el mensaje del servidor en errores");
revisar(recibidas[1] && recibidas[1].contexto.length === 2 && recibidas[1].contexto[0].startsWith("Persona: "), "manda el contexto de la conversación");

await pagina.reload({ waitUntil: "networkidle" });
revisar(await pagina.isVisible("#chat") && await pagina.isHidden("#politicas"), "al recargar no vuelve a pedir políticas ya aceptadas");

revisar(errores.length === 0, "sin errores de JavaScript");
errores.forEach((e) => console.log("   - " + e));

// axe con el chat abierto. Otro contexto, porque la CSP (bien) bloquea inyectar axe.
const contextoAxe = await navegador.newContext({ bypassCSP: true });
await contextoAxe.route("**/assets/js/config.v2.js", (r) => r.fulfill({ contentType: "text/javascript", body: config }));
await contextoAxe.route(`${API}/**`, (r) => r.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json: {} }));
await contextoAxe.addInitScript((r) => localStorage.setItem("cecapi.politicas", r), JSON.stringify(registro));
const paginaAxe = await contextoAxe.newPage();
await paginaAxe.goto(URL_SITIO, { waitUntil: "networkidle" });
await paginaAxe.addScriptTag({ path: AXE });
const axe = await paginaAxe.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }));
revisar(axe.violations.length === 0, "axe sin fallas con el chat abierto");
axe.violations.forEach((v) => console.log(`   - ${v.id}: ${v.help}`));

await navegador.close();
servidor.close();
process.exit(fallas ? 1 : 0);
