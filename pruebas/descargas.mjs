// Prueba del panel de descargas: solo se aceptan enlaces https a GitHub Releases.
import { createRequire } from "node:module";
import { servir } from "./servidor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const PUERTO = 8094;
const SITIO = `http://localhost:${PUERTO}/PaginaAsistenteCECAPI/descargas.html`;

let fallas = 0;
const revisar = (ok, d) => { console.log(`${ok ? "bien " : "FALLA"} ${d}`); if (!ok) fallas++; };

const servidor = await servir(PUERTO);
const navegador = await chromium.launch();

async function abrir(apps) {
  const pagina = await (await navegador.newContext()).newPage();
  await pagina.route("**/datos/descargas.v1.json", (r) => r.fulfill({ json: { apps } }));
  await pagina.goto(SITIO, { waitUntil: "networkidle" });
  return pagina;
}
const app = (id, url) => ({ id, plataforma: id === "android" ? "Android" : "Windows", nombre: "App " + id, requisitos: "x", version: "1.0.0", archivo: "app." + (id === "android" ? "apk" : "exe"), url, tamanoBytes: 5242880, sha256: "ab".repeat(32) });

let p = await abrir([
  app("android", "https://github.com/FernandezQuintanaJose/EstadiasAppMobil/releases/download/v1.0.0/app.apk"),
  app("windows", "https://ejemplo.com/app.exe")
]);
revisar((await p.locator("a.boton-principal").count()) === 1, "solo se muestra el enlace de GitHub Releases");
revisar((await p.textContent("#lista-descargas")).includes("Todavía no hay una versión publicada para Windows"), "un enlace a otro sitio se trata como sin versión");
revisar((await p.textContent("#lista-descargas")).includes("5 MB") && (await p.textContent("#lista-descargas")).includes("abab"), "se ven tamaño y suma SHA-256");
revisar((await p.textContent("main")).includes("No están en Google Play ni en la Microsoft Store"), "el texto aclara que no están en las tiendas");

p = await abrir([app("windows", "http://github.com/x/y/releases/download/v1/app.exe"), app("android", "https://github.com/x/y/archive/main.zip")]);
revisar((await p.locator("a.boton-principal").count()) === 0, "http o rutas fuera de releases se descartan");

await navegador.close();
servidor.close();
process.exit(fallas ? 1 : 0);
