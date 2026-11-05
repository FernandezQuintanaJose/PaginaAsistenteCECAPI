// PROTOTIPO: todo es simulado. No hay servidor, ni login real, ni descargas reales.

const $ = (id) => document.getElementById(id);

/* ---------- Navegación entre vistas ---------- */
document.querySelectorAll('[data-vista]').forEach((boton) => {
  boton.addEventListener('click', () => {
    const vista = boton.dataset.vista;
    document.querySelectorAll('.vista').forEach((v) => (v.hidden = v.id !== 'vista-' + vista));
    document.querySelectorAll('[data-vista]').forEach((b) => b.removeAttribute('aria-current'));
    boton.setAttribute('aria-current', 'page');
    if (vista === 'chat') $('mensaje').focus();
    else $('titulo-descargas').focus();
  });
});

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

/* ---------- Inicio de sesión con Google ---------- */
// Pega aquí el "ID de cliente" que te da Google Cloud Console (ver instrucciones).
const GOOGLE_CLIENT_ID = '815992457051-jcnemqoj7idscjl2n4s5pqq91q8tunnv.apps.googleusercontent.com';

const CLAVE_SESION = 'cecapi-sesion';

// El "credential" de Google es un JWT: tres partes separadas por puntos.
// La del medio trae los datos de la persona (nombre, email, foto…).
function leerToken(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)); // TextDecoder respeta tildes y ñ
}

function mostrarUsuario(datos) {
  $('usuario-nombre').textContent = datos.given_name || datos.name || datos.email;
  $('usuario-nombre').title = datos.email;
  $('usuario-foto').src = datos.picture || '';
  $('usuario-foto').hidden = !datos.picture;
  $('usuario').hidden = false;
  $('login-google').hidden = true;
}

function mostrarLogin() {
  $('usuario').hidden = true;
  $('login-google').hidden = false;
}

function alIniciarSesion(respuesta) {
  // OJO: esto solo sirve para mostrar el nombre en la página. Cuando haya servidor,
  // hay que enviarle respuesta.credential y que él lo verifique con Google.
  const datos = leerToken(respuesta.credential);
  try { localStorage.setItem(CLAVE_SESION, respuesta.credential); } catch {}
  mostrarUsuario(datos);
  $('anuncio').textContent = 'Sesión iniciada como ' + (datos.name || datos.email) + '.';
}

function recuperarSesion() {
  try {
    const token = localStorage.getItem(CLAVE_SESION);
    if (!token) return;
    const datos = leerToken(token);
    if (datos.exp * 1000 > Date.now()) mostrarUsuario(datos); // el token caduca en 1 hora
    else localStorage.removeItem(CLAVE_SESION);
  } catch { /* token dañado o almacenamiento bloqueado: se ignora */ }
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
  if ($('usuario').hidden) google.accounts.id.prompt(); // ventanita de "Continuar como…"
}

$('cerrar-sesion').addEventListener('click', () => {
  try { localStorage.removeItem(CLAVE_SESION); } catch {}
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
  mostrarLogin();
  $('anuncio').textContent = 'Sesión cerrada.';
});

recuperarSesion();
// La librería de Google carga en paralelo: si ya está lista, se usa; si no, avisa al terminar.
if (window.google?.accounts?.id) iniciarGoogle();
else window.onGoogleLibraryLoad = iniciarGoogle;

/* ---------- Chat ---------- */
const conversacion = $('conversacion');
let primerMensaje = true;

function agregarMensaje(texto, quien) {
  const li = document.createElement('li');
  li.className = 'msg ' + quien;
  li.innerHTML = `<span class="autor">${quien === 'ia' ? 'CECAPI' : 'Tú'}</span>`;
  const p = document.createElement('p');
  p.textContent = texto; // textContent evita inyectar HTML
  li.appendChild(p);
  conversacion.appendChild(li);
  li.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

$('form-chat').addEventListener('submit', async (e) => {
  e.preventDefault();
  const campo = $('mensaje');
  const texto = campo.value.trim();
  if (!texto) return;

  agregarMensaje(texto, 'usuario');
  campo.value = '';

  // Simula que el servidor "se despierta" en el primer mensaje
  if (primerMensaje) {
    $('aviso-servidor').hidden = false;
    $('anuncio').textContent = 'El servidor se está despertando, espera un momento.';
    await esperar(2500);
    $('aviso-servidor').hidden = true;
    primerMensaje = false;
  }

  await esperar(800);
  const respuesta = 'Esta es una respuesta de ejemplo. Aquí aparecerá lo que conteste la IA de CECAPI.';
  agregarMensaje(respuesta, 'ia');
  $('anuncio').textContent = 'CECAPI responde: ' + respuesta; // lo lee el lector de pantalla
  campo.focus(); // el foco vuelve al cuadro de texto
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

  boton.hidden = false;
  boton.addEventListener('click', () => {
    if (escuchando) { rec.stop(); return; }
    textoPrevio = campo.value.trim();
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
  });

  let errorDictado = '';

  rec.addEventListener('end', () => {
    marcar(false);
    if (errorDictado) {
      $('anuncio').textContent = errorDictado;
      if (!campo.value.trim()) campo.placeholder = errorDictado; // visible en pantalla
      errorDictado = '';
    } else {
      $('anuncio').textContent = campo.value.trim()
        ? 'Dictado terminado. Revisa el mensaje y pulsa Enviar.'
        : 'No se escuchó nada.';
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

$('ver-politicas').addEventListener('click', () => {
  pagina = 0;
  dialogo.showModal();
  mostrarPolitica();
});
$('repetir').addEventListener('click', () => leer($('titulo-politica').textContent + '. ' + $('texto-politica').textContent));
$('siguiente').addEventListener('click', () => { pagina++; mostrarPolitica(); });
$('aceptar').addEventListener('click', () => {
  if (!$('es-mayor').checked) {
    leer('Debes declarar que eres mayor de 18 años para aceptar.');
    $('es-mayor').focus();
    return;
  }
  cerrarPoliticas();
});
$('rechazar').addEventListener('click', cerrarPoliticas);
$('despues').addEventListener('click', cerrarPoliticas);
dialogo.addEventListener('cancel', () => speechSynthesis.cancel());
