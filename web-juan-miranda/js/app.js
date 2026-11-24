// PROTOTIPO: con API_URL vacía el chat es simulado (modo prueba). Las descargas aún no son reales.

const $ = (id) => document.getElementById(id);

/* ---------- Tamaño de texto y contraste ---------- */
let tamano = 100;
const ajustarTexto = (paso) => {
  tamano = Math.min(150, Math.max(85, tamano + paso));
  document.documentElement.style.fontSize = tamano + '%';
};
$('texto-mas').addEventListener('click', () => ajustarTexto(10));
$('texto-menos').addEventListener('click', () => ajustarTexto(-10));
$('contraste').addEventListener('click', (e) => {
  const activo = document.body.classList.toggle('contraste');
  e.currentTarget.setAttribute('aria-pressed', activo);
});

/* ---------- Conexión con el servidor (API) ---------- */
// Dirección del servidor de CECAPI, sin "/" al final. Ejemplo: 'https://api.cecapi.org'
// Mientras esté vacía, la página funciona en MODO PRUEBA: respuestas simuladas.
//
// Lo que el servidor debe ofrecer:
//   POST /auth/google  { credential }  → verifica el token con Google, crea una cookie
//                                         de sesión HttpOnly + Secure + SameSite y
//                                         responde { nombre, email, foto }
//   GET  /auth/sesion                  → { nombre, email, foto } si la cookie es válida, si no 401
//   POST /auth/salir                   → borra la cookie
//   POST /chat         { mensaje }     → { respuesta }  (401 sin sesión, 429 si hay demasiados mensajes)
//
// La llave de la IA vive SOLO en el servidor. Nunca la pongas en este archivo.
// En el servidor, CORS debe permitir solo el dominio de esta página (nunca "*")
// y aceptar credenciales, porque la cookie viaja en cada llamada.
const API_URL = '';
const MODO_PRUEBA = !API_URL;

const TIEMPO_NORMAL = 15000;   // 15 s
const TIEMPO_CHAT = 60000;     // 60 s: el servidor puede estar "despertando"

class ErrorApi extends Error {
  constructor(tipo, mensaje) { super(mensaje); this.tipo = tipo; }
}

// Llama al servidor con tiempo de espera y convierte cualquier fallo en un mensaje claro.
async function llamarApi(ruta, { datos, tiempo = TIEMPO_NORMAL } = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), tiempo);
  try {
    const r = await fetch(API_URL + ruta, {
      method: datos === undefined ? 'GET' : 'POST',
      headers: datos === undefined ? {} : { 'Content-Type': 'application/json' },
      body: datos === undefined ? undefined : JSON.stringify(datos),
      credentials: 'include', // envía la cookie de sesión; el token no se guarda en la página
      signal: control.signal,
    });
    if (r.status === 401) throw new ErrorApi('sesion', 'Tu sesión terminó. Vuelve a iniciar sesión con Google.');
    if (r.status === 429) throw new ErrorApi('limite', 'Enviaste muchos mensajes seguidos. Espera un momento e inténtalo de nuevo.');
    if (!r.ok) throw new ErrorApi('servidor', 'El servidor tuvo un problema. Inténtalo de nuevo en un momento.');
    return r.status === 204 ? null : await r.json();
  } catch (e) {
    if (e instanceof ErrorApi) throw e;
    if (e.name === 'AbortError') throw new ErrorApi('tiempo', 'El servidor tardó demasiado en responder. Inténtalo de nuevo.');
    throw new ErrorApi('red', 'No se pudo conectar con el servidor. Revisa tu conexión a internet.');
  } finally {
    clearTimeout(reloj);
  }
}

/* ---------- Inicio de sesión con Google ---------- */
// Pega aquí el "ID de cliente" que te da Google Cloud Console (ver instrucciones).
// Este ID es público por diseño; no es una llave secreta.
const GOOGLE_CLIENT_ID = '704910080031-3p6ppcoqd9k129l6i4g1jo78uak0jovu.apps.googleusercontent.com';

// Datos de la persona que inició sesión. Solo en memoria: al recargar se pierden
// y se recuperan desde la cookie del servidor (o con el inicio automático de Google).
let sesion = null;

// Versiones anteriores guardaban el token en localStorage: se borra si quedó.
try { localStorage.removeItem('cecapi-sesion'); } catch {}

// El "credential" de Google es un JWT: tres partes separadas por puntos.
// La del medio trae los datos de la persona. Solo se lee en MODO PRUEBA,
// porque sin servidor nadie verifica que sea auténtico.
function leerToken(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const d = JSON.parse(new TextDecoder().decode(bytes)); // TextDecoder respeta tildes y ñ
  return { nombre: d.given_name || d.name, email: d.email, foto: d.picture };
}

function mostrarUsuario(datos) {
  sesion = datos;
  $('usuario-nombre').textContent = datos.nombre || datos.email;
  $('usuario-nombre').title = datos.email || '';
  $('usuario-foto').src = datos.foto || '';
  $('usuario-foto').hidden = !datos.foto;
  $('usuario').hidden = false;
  $('login-google').hidden = true;
}

function mostrarLogin() {
  sesion = null;
  $('usuario').hidden = true;
  $('login-google').hidden = false;
}

async function alIniciarSesion(respuesta) {
  try {
    // Con servidor: él verifica el token con Google y crea la cookie de sesión.
    const datos = MODO_PRUEBA
      ? leerToken(respuesta.credential)
      : await llamarApi('/auth/google', { datos: { credential: respuesta.credential } });
    mostrarUsuario(datos);
    $('anuncio').textContent = 'Sesión iniciada como ' + (datos.nombre || datos.email) + '.';
  } catch (e) {
    mostrarLogin();
    $('anuncio').textContent = 'No se pudo iniciar sesión. ' + e.message;
  }
}

async function recuperarSesion() {
  if (MODO_PRUEBA) return; // sin servidor, Google vuelve a iniciar sesión solo (auto_select)
  try { mostrarUsuario(await llamarApi('/auth/sesion')); } catch { /* sin sesión: se muestra el botón */ }
}

function iniciarGoogle() {
  if (GOOGLE_CLIENT_ID.startsWith('PON_AQUI')) {
    $('login-google').innerHTML = '<span class="aviso-login">Falta configurar el ID de cliente de Google</span>';
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: alIniciarSesion,
    auto_select: true, // si ya entró antes, vuelve a entrar sin pulsar nada
  });
  google.accounts.id.renderButton($('login-google'), {
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    text: 'signin_with',
    locale: 'es',
  });
  if (!sesion) google.accounts.id.prompt(); // ventanita de "Continuar como…"
}

$('cerrar-sesion').addEventListener('click', async () => {
  if (!MODO_PRUEBA) { try { await llamarApi('/auth/salir', { datos: {} }); } catch { /* se cierra igual */ } }
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
  mostrarLogin();
  $('anuncio').textContent = 'Sesión cerrada.';
});

// Primero se pregunta al servidor si ya hay sesión; luego se carga el botón de Google.
recuperarSesion().finally(() => {
  if (window.google?.accounts?.id) iniciarGoogle();
  else window.onGoogleLibraryLoad = iniciarGoogle;
});

/* ---------- Chat ---------- */
const conversacion = $('conversacion');
const botonEnviar = $('form-chat').querySelector('button[type="submit"]');

function agregarMensaje(texto, quien, esError = false) {
  const li = document.createElement('li');
  li.className = 'msg ' + quien + (esError ? ' error' : '');
  ocultarTitulo(); // con el primer mensaje el título deja su espacio a la conversación
  li.innerHTML = `<span class="autor">${quien === 'ia' ? 'CECAPI' : 'Tú'}</span>`;
  const p = document.createElement('p');
  p.textContent = texto; // textContent evita inyectar HTML
  li.appendChild(p);
  conversacion.appendChild(li);
  li.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function responder(texto, esError = false) {
  agregarMensaje(texto, 'ia', esError);
  $('anuncio').textContent = (esError ? 'Aviso: ' : 'CECAPI responde: ') + texto; // lo lee el lector de pantalla
}

async function pedirRespuesta(texto) {
  if (MODO_PRUEBA) {
    await esperar(800);
    return 'Esta es una respuesta de ejemplo. Aquí aparecerá lo que conteste la IA de CECAPI.';
  }
  // Si tarda más de 3 s, probablemente el servidor se está despertando: se avisa.
  const avisoLento = setTimeout(() => {
    $('aviso-servidor').hidden = false;
    $('anuncio').textContent = 'El servidor se está despertando, espera un momento.';
  }, 3000);
  try {
    const r = await llamarApi('/chat', { datos: { mensaje: texto }, tiempo: TIEMPO_CHAT });
    return r.respuesta;
  } finally {
    clearTimeout(avisoLento);
    $('aviso-servidor').hidden = true;
  }
}

// Mide la barra de arriba para que el chat quepa completo en la pantalla (ver #vista-chat en el CSS).
// Se vuelve a medir si cambia de alto: al iniciar sesión, al agrandar el texto o en el celular.
const barra = document.querySelector('.barra');
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--alto-barra', barra.offsetHeight + 'px');
}).observe(barra);

// Al empezar a escribir, el título se pliega y la conversación ocupa su espacio.
// Sigue en la página para los lectores de pantalla; solo deja de verse.
function ocultarTitulo() { $('bienvenida').classList.add('oculta'); }
$('mensaje').addEventListener('input', ocultarTitulo);

$('form-chat').addEventListener('submit', async (e) => {
  e.preventDefault();
  const campo = $('mensaje');
  const texto = campo.value.trim();
  if (!texto || botonEnviar.disabled) return;

  // Sin sesión no se envía nada: así nadie usa la IA sin cuenta.
  if (!sesion) {
    responder('Para usar el chat, primero inicia sesión con Google (botón arriba a la derecha). Tu mensaje sigue en el cuadro de texto.', true);
    return;
  }

  agregarMensaje(texto, 'usuario');
  campo.value = '';
  botonEnviar.disabled = true; // evita mensajes duplicados mientras se espera

  try {
    responder(await pedirRespuesta(texto));
  } catch (err) {
    responder(err.message, true);
    if (err.tipo === 'sesion') mostrarLogin();
    if (!campo.value) campo.value = texto; // se devuelve el mensaje para reenviarlo
  } finally {
    botonEnviar.disabled = false;
    campo.focus(); // el foco vuelve al cuadro de texto
  }
});

$('mensaje').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('form-chat').requestSubmit();
  }
});

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Micrófono: dictar el mensaje por voz ---------- */
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
// Opera y Brave dicen tener reconocimiento de voz, pero no tienen acceso al
// servicio de Google que lo hace funcionar: el botón aparecería pero fallaría.
const navegadorSinDictado = /\bOPR\/|\bOpera\b/.test(navigator.userAgent) || !!navigator.brave;
if (Reconocimiento && !navegadorSinDictado) {
  const boton = $('microfono');
  const campo = $('mensaje');
  const rec = new Reconocimiento();
  rec.lang = 'es-ES';
  rec.interimResults = true; // va mostrando el texto mientras hablas
  rec.continuous = false;    // se detiene solo cuando dejas de hablar

  let escuchando = false;
  let textoPrevio = '';

  const marcar = (activo) => {
    escuchando = activo;
    boton.setAttribute('aria-pressed', activo);
    boton.setAttribute('aria-label', activo ? 'Detener dictado' : 'Dictar mensaje por voz');
    boton.title = boton.getAttribute('aria-label');
    campo.placeholder = activo ? 'Escuchando… habla ahora' : 'Escribe tu mensaje…';
  };

  boton.addEventListener('click', () => {
    if (escuchando) { rec.stop(); return; }
    textoPrevio = campo.value.trim();
    huboVoz = false;
    try { rec.start(); } catch { /* ya estaba iniciado */ }
  });

  rec.addEventListener('start', () => {
    marcar(true);
    $('anuncio').textContent = 'Micrófono activado. Habla ahora.';
  });

  rec.addEventListener('result', (e) => {
    let dicho = '';
    for (const r of e.results) dicho += r[0].transcript;
    campo.value = (textoPrevio ? textoPrevio + ' ' : '') + dicho.trim();
    if (dicho.trim()) huboVoz = true;
  });

  let errorDictado = '';
  let huboVoz = false; // si se dictó algo en esta ronda

  rec.addEventListener('end', () => {
    marcar(false);
    if (errorDictado) {
      $('anuncio').textContent = errorDictado;
      if (!campo.value.trim()) campo.placeholder = errorDictado; // visible en pantalla
      errorDictado = '';
    } else if (huboVoz && campo.value.trim()) {
      // Al terminar de hablar, el mensaje se envía solo
      $('anuncio').textContent = 'Dictado terminado. Enviando mensaje.';
      $('form-chat').requestSubmit();
    } else {
      $('anuncio').textContent = 'No se escuchó nada.';
    }
    campo.focus();
  });

  rec.addEventListener('error', (e) => {
    const mensajes = {
      'not-allowed': 'No hay permiso para usar el micrófono. Actívalo en el navegador.',
      'service-not-allowed': 'No hay permiso para usar el micrófono. Actívalo en el navegador.',
      'no-speech': 'No se escuchó nada. Inténtalo de nuevo.',
      'audio-capture': 'No se encontró ningún micrófono.',
      'network': 'El dictado necesita conexión a internet.',
    };
    if (e.error === 'aborted') return;
    errorDictado = mensajes[e.error] || 'No se pudo usar el micrófono.';
  });
} else {
  // El botón se muestra igual; al pulsarlo avisa que este navegador no permite dictar.
  $('microfono').addEventListener('click', () => {
    const aviso = 'Este navegador no permite dictar por voz. Prueba con Chrome o Edge.';
    $('anuncio').textContent = aviso;
    $('mensaje').placeholder = aviso;
    $('mensaje').focus();
  });
}

/* ---------- Políticas con audio ---------- */
const politicas = [
  { titulo: 'Política de uso', texto: 'Aquí irá el texto de la política de uso de CECAPI. Este es un texto de ejemplo.' },
  { titulo: 'Política de privacidad', texto: 'Aquí irá el texto de la política de privacidad. Explica qué datos se guardan y para qué.' },
];
let pagina = 0;
const dialogo = $('politicas');

function mostrarPolitica() {
  const p = politicas[pagina];
  $('titulo-politica').textContent = p.titulo;
  $('texto-politica').textContent = p.texto;
  $('paso-politica').textContent = `Página ${pagina + 1} de ${politicas.length}`;
  $('siguiente').disabled = pagina === politicas.length - 1;
  leer(p.titulo + '. ' + p.texto);
  $('titulo-politica').focus();
}

function leer(texto) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const voz = new SpeechSynthesisUtterance(texto);
  voz.lang = 'es-ES';
  speechSynthesis.speak(voz);
}

function cerrarPoliticas() {
  speechSynthesis.cancel();
  dialogo.close();
}

// Se muestra cada vez que se abre la página
function pedirPoliticas() {
  pagina = 0;
  dialogo.showModal();
  mostrarPolitica();
}

$('repetir').addEventListener('click', () => leer($('titulo-politica').textContent + '. ' + $('texto-politica').textContent));
$('siguiente').addEventListener('click', () => { pagina++; mostrarPolitica(); });
$('aceptar').addEventListener('click', () => {
  if (!$('es-mayor').checked) {
    leer('Debes declarar que eres mayor de 18 años para aceptar.');
    $('es-mayor').focus();
    return;
  }
  cerrarPoliticas();
  $('mensaje').focus();
});
$('rechazar').addEventListener('click', () => {
  leer('Para usar CECAPI necesitas aceptar las políticas.');
  $('paso-politica').textContent = 'Para usar CECAPI necesitas aceptar las políticas.';
});
// No se puede cerrar con Escape sin aceptar
dialogo.addEventListener('cancel', (e) => e.preventDefault());
pedirPoliticas();
