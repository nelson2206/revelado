// App del invitado (se abre desde el QR). Vistas construidas una vez y actualizadas por clave cada 5 s.
(() => {
  const { codigo, api, postJSON, guardar, leer, el, ico, aviso, fechaLarga, fechaSello, comprimir, fotoUrl, reconciliar, contar, hoja, visor, reducir } = FV;
  const app = document.getElementById('app');
  const navIn = document.getElementById('nav-in');
  const nav = document.getElementById('nav');
  const archivo = document.getElementById('archivo');
  const flash = document.getElementById('flash');
  const CLAVE = 'fv:' + codigo;

  let info = null, est = null, sesion = leer(CLAVE), tab = 'retos', retoElegido = null;
  const subiendo = {}, previas = {}, pendientes = new Set();
  let puntosPrevios = null, posPrevias = new Map();
  const v = {}; // referencias a nodos de cada vista

  const TABS = { retos: ['Retos', 'camera'], ranking: ['Ranking', 'trophy'], album: ['Álbum', 'images-square'], firmas: ['Firmas', 'signature'] };
  const MODULO_TAB = { firmas: 'firmas' };
  const hora = (t) => new Date(t).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });

  // ---------- cola sin señal (IndexedDB) ----------
  const cola = (() => {
    let dbp;
    const abrir = () => dbp || (dbp = new Promise((ok, mal) => {
      const r = indexedDB.open('fv-cola', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fotos', { keyPath: 'k' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    }));
    const tx = async (modo, fn) => {
      const db = await abrir();
      return new Promise((ok, mal) => { const t = db.transaction('fotos', modo); const res = fn(t.objectStore('fotos')); t.oncomplete = () => ok(res?.result); t.onerror = () => mal(t.error); });
    };
    return {
      poner: (i) => tx('readwrite', (s) => s.put(i)).catch(() => {}),
      quitar: (k) => tx('readwrite', (s) => s.delete(k)).catch(() => {}),
      todos: () => tx('readonly', (s) => s.getAll()).then((x) => (x || []).filter((i) => i.codigo === codigo)).catch(() => []),
    };
  })();

  // ---------- arranque ----------
  async function iniciar() {
    if (!codigo) return mensaje('Falta el código del evento', 'Escanea de nuevo el QR de tu mesa.');
    try { info = await api('/e/' + codigo); }
    catch (e) { return mensaje(e.status === 404 ? 'No encontramos este evento' : 'No pudimos cargar la fiesta', e.status === 404 ? 'Revisa el QR o el enlace que te enviaron.' : e.message); }
    // ?tema= solo para la vista previa del panel (no guarda nada)
    const previa = new URLSearchParams(location.search).get('tema');
    if (previa && TEMAS[previa]) { info.tema = previa; info.previa = true; }
    aplicarTema(info.tema);
    document.title = `${info.nombres} · Retos`;
    if (!sesion?.token || info.soloLectura) return portada();
    await refrescar();
    if (sesion) entrar();
  }

  function mensaje(t, d) {
    app.replaceChildren(el('section', { class: 'portada' }, el('div', {}, el('h1', { class: 'display portada-nombres', texto: t }), el('p', { class: 'portada-mensaje', style: 'margin-top:16px', texto: d }))));
  }

  function portada() {
    nav.classList.add('oculto');
    const nombre = el('input', { class: 'input', id: 'nombre', autocomplete: 'name', maxlength: 40, required: true, 'aria-describedby': 'ayuda-nombre' });
    const mesa = el('input', { class: 'input', id: 'mesa', maxlength: 20, inputmode: 'numeric' });
    const consiento = el('input', { type: 'checkbox', id: 'consiento' });
    const err = el('p', { class: 'error-campo', role: 'alert' });
    const btn = el('button', { class: 'btn ancho', type: 'submit' }, 'Entrar a la fiesta', ico('arrow-right'));
    const form = el('form', { class: 'portada-form', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (nombre.value.trim().length < 2) { err.textContent = 'Escribe tu nombre para aparecer en el ranking.'; nombre.focus(); return; }
      if (!consiento.checked) { err.textContent = 'Marca la autorización para poder participar.'; consiento.focus(); return; }
      btn.disabled = true;
      try {
        const r = await postJSON(`/e/${codigo}/invitados`, { nombre: nombre.value, mesa: mesa.value, consiento: true });
        sesion = { token: r.token, nombre: r.nombre };
        guardar(CLAVE, sesion);
        await refrescar();
        entrar();
      } catch (er) { err.textContent = er.message; btn.disabled = false; }
    } },
      el('h2', { texto: 'Únete al juego' }),
      el('p', { texto: 'Cumple los retos con fotos, suma puntos y gana premios. Sin descargar nada.' }),
      el('label', { class: 'campo', for: 'nombre' }, el('span', { texto: 'Tu nombre' }), nombre, el('small', { id: 'ayuda-nombre', texto: 'Así aparecerás en el ranking y en la pantalla.' })),
      el('label', { class: 'campo', for: 'mesa' }, el('span', { texto: 'Número de mesa (opcional)' }), mesa),
      el('label', { class: 'check', for: 'consiento' }, consiento,
        el('span', {}, `Autorizo que mi nombre y las fotos que suba se muestren a los invitados y en la pantalla del evento, y que los novios las conserven. Se borran de este servicio ${info.diasRetencion >= 365 ? 'a los 12 meses' : `a los ${info.diasRetencion || 90} días`} de la boda. `,
          el('a', { href: '/revelado/privacidad.html', target: '_blank', rel: 'noopener' }, 'Política de privacidad'))),
      err, btn);
    const demo = el('div', { class: 'portada-form' },
      el('div', { class: 'demo-aviso' }, ico('info'), el('span', { texto: 'Esta es una boda de demostración. Puedes recorrerla, pero aquí no se suben fotos.' })),
      el('button', { class: 'btn ancho', onclick: async () => { sesion = { demo: true }; await refrescar(); entrar(); } }, 'Ver la demo como invitada', ico('arrow-right')));
    // Portada compuesta como una invitación impresa: nombres en dos líneas unidos por un "&" en cursiva
    const partes = String(info.nombres).split(/\s+y\s+|\s*&\s*/i).map((x) => x.trim()).filter(Boolean);
    const titulo = el('h1', { class: 'display portada-nombres', 'aria-label': info.nombres },
      partes.length === 2 ? [el('span', { class: 'nombre', texto: partes[0] }), el('span', { class: 'y', 'aria-hidden': 'true', texto: '&' }), el('span', { class: 'nombre', texto: partes[1] })] : info.nombres);
    app.replaceChildren(el('section', { class: 'portada' },
      el('div', { class: 'invitacion' },
        info.socio ? el('p', { class: 'inv-socio', texto: `Una experiencia de ${info.socio}` }) : null,
        el('span', { class: 'monograma', 'aria-hidden': 'true', texto: monograma(info.nombres) }),
        titulo,
        el('span', { class: 'inv-regla', 'aria-hidden': 'true' }),
        el('div', { class: 'portada-meta' },
          info.fecha ? (info.desechable ? el('span', { class: 'sello', 'aria-label': fechaLarga(info.fecha), texto: fechaSello(info.fecha) }) : el('span', { class: 'fecha', texto: fechaLarga(info.fecha) })) : null,
          info.lugar ? el('span', { texto: info.lugar }) : null),
        info.mensaje ? el('p', { class: 'portada-mensaje', texto: info.mensaje }) : null),
      info.soloLectura ? demo : form));
  }

  // ---------- estado en vivo ----------
  async function refrescar() {
    try {
      est = await api(`/e/${codigo}/estado?n=120`, { headers: { 'x-token': sesion?.token || '' } });
      if (sesion?.token && !est.yo) { sesion = null; guardar(CLAVE, null); portada(); }
      if (!info.previa && est.tema && est.tema !== info.tema) { info.tema = est.tema; aplicarTema(est.tema); }
    } catch { /* sin señal: seguimos con lo último */ }
  }

  function entrar() {
    construir();
    const tabs = Object.keys(TABS).filter((t) => !MODULO_TAB[t] || info.modulos.includes(MODULO_TAB[t]));
    navIn.replaceChildren(...tabs.map((t) => el('button', { 'data-tab': t, 'aria-label': TABS[t][0], onclick: () => irA(t) }, ico(TABS[t][1]), el('span', { texto: TABS[t][0] }))));
    nav.classList.remove('oculto');
    app.removeAttribute('aria-busy');
    scrollTo({ top: 0 });
    irA(tab, true);
    actualizar();
    if (!sesion.demo) reintentarCola();
  }

  function irA(t, inicial) {
    tab = t;
    for (const b of navIn.children) { const a = b.dataset.tab === t; b.classList.toggle('activo', a); b.setAttribute('aria-current', a ? 'page' : 'false'); }
    for (const [k, n] of Object.entries(v.vistas)) n.hidden = k !== t;
    if (!inicial) { scrollTo({ top: 0 }); if (!reducir.matches) v.vistas[t].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' }); }
  }

  // ---------- construcción (una vez) ----------
  function construir() {
    v.puntos = el('b', { texto: '0' });
    v.pos = el('span', {});
    v.marcador = el('div', { class: 'marcador', 'aria-live': 'polite', 'aria-label': 'Tus puntos' }, v.puntos, el('span', { texto: 'pts' }), v.pos);
    const mesaBtn = info.modulos.includes('mesa') ? el('button', { class: 'btn-icono', 'aria-label': 'Buscar mi mesa', onclick: abrirMesa }, ico('armchair')) : null;
    const barra = el('header', { class: 'barra' }, el('h1', { class: 'display barra-nombres', texto: info.nombres }), el('div', { class: 'barra-acciones' }, mesaBtn, v.marcador));
    v.vistas = { retos: vistaRetos(), ranking: vistaRanking(), album: vistaAlbum(), firmas: vistaFirmas() };
    app.replaceChildren(barra, ...Object.values(v.vistas));
  }

  function vistaRetos() {
    v.hechos = el('b', { texto: '0' });
    v.relampago = el('div', {});
    // Avance como tira de negativos: un cuadro por reto, se llena al cumplirlo
    v.tira = el('div', { class: 'tira', 'aria-hidden': 'true', style: `grid-template-columns:repeat(${info.retos.length},1fr)` }, info.retos.map(() => el('i')));
    v.subRetos = el('p', { class: 'suave sub-retos' });
    v.siguiente = el('div', {});
    v.trivia = el('div', {});
    v.rollo = el('div', { class: 'rollo' });
    return el('section', { 'aria-label': 'Retos' }, v.relampago,
      el('div', { class: 'titulo-vista' }, el('h2', { class: 'display', texto: 'Retos' }),
        el('div', { class: 'contador' }, v.hechos, el('small', { texto: `de ${info.retos.length} cumplidos` }))),
      v.tira, v.subRetos, v.siguiente, v.trivia,
      el('div', { class: 'rollo-cabeza' }, el('span', { class: 'cursiva', texto: 'El rollo completo' }), el('small', { texto: `${info.retos.length} retos` })),
      v.rollo);
  }
  function vistaRanking() {
    v.subRank = el('p', { class: 'suave', style: 'margin:-6px 0 18px' });
    v.podio = el('div', { class: 'podio' });
    v.lista = el('div', { class: 'lista-rank' });
    v.tituloRank = el('h2', { class: 'display', texto: 'Ranking' });
    return el('section', { 'aria-label': 'Ranking' }, el('div', { class: 'titulo-vista' }, v.tituloRank), v.subRank, v.podio, v.lista);
  }
  function vistaAlbum() {
    v.subAlbum = el('p', { class: 'suave', style: 'margin:-6px 0 18px' });
    v.muro = el('div', { class: 'muro' });
    v.cerrado = el('div', {});
    return el('section', { 'aria-label': 'Álbum' }, el('div', { class: 'titulo-vista' }, el('h2', { class: 'display', texto: 'Álbum' })), v.subAlbum, v.cerrado, v.muro);
  }
  function vistaFirmas() {
    const txt = el('textarea', { class: 'input', id: 'firma', maxlength: 400, 'aria-describedby': 'ayuda-firma', disabled: sesion?.demo || null });
    const btn = el('button', { class: 'btn', style: 'margin-top:12px', disabled: sesion?.demo || null, onclick: async () => {
      if (txt.value.trim().length < 2) return aviso('Escribe tu mensaje para los novios', true);
      btn.disabled = true;
      try { await postJSON(`/e/${codigo}/firmas`, { token: sesion.token, texto: txt.value }); txt.value = ''; aviso('Tu mensaje llegó a los novios'); await refrescar(); actualizar(); }
      catch (e) { aviso(e.message, true); }
      btn.disabled = false;
    } }, 'Firmar', ico('signature'));
    v.firmas = el('div', {});
    return el('section', { 'aria-label': 'Libro de firmas' },
      el('div', { class: 'titulo-vista' }, el('h2', { class: 'display', texto: 'Firmas' })),
      el('label', { class: 'campo', for: 'firma' }, el('span', { texto: 'Un deseo, un consejo o un recuerdo para los novios' }), txt,
        el('small', { id: 'ayuda-firma', texto: sesion?.demo ? 'En la demo no se pueden firmar mensajes.' : 'Lo verán los invitados y los novios.' })),
      btn, el('div', { style: 'margin-top:20px' }, v.firmas));
  }

  // ---------- actualización (cada 5 s) ----------
  function actualizar() {
    if (!est || !v.vistas) return;
    actualizarMarcador();
    actualizarRetos();
    actualizarRanking();
    actualizarAlbum();
    actualizarFirmas();
  }

  function actualizarMarcador() {
    const yo = est.yo;
    const pts = yo?.puntos ?? 0;
    if (puntosPrevios != null && pts > puntosPrevios) {
      v.marcador.classList.remove('pop'); void v.marcador.offsetWidth; v.marcador.classList.add('pop');
      const mas = el('span', { class: 'mas-puntos', 'aria-hidden': 'true', texto: `+${pts - puntosPrevios}` });
      v.marcador.append(mas); setTimeout(() => mas.remove(), 1100);
    }
    puntosPrevios = pts;
    contar(v.puntos, pts);
    v.pos.textContent = yo?.posicion ? `· ${yo.posicion}.º` : '';
    v.marcador.setAttribute('aria-label', `Tienes ${pts} puntos${yo?.posicion ? `, puesto ${yo.posicion}` : ''}`);
  }

  const relampagoActivo = () => (est?.relampago?.relampago_hasta > Date.now() ? est.relampago : null);
  const reloj = (hasta) => { const s = Math.max(0, Math.round((hasta - Date.now()) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function actualizarRetos() {
    const mias = new Map((est.yo?.fotos || []).map((f) => [f.reto_id, f]));
    const hechos = info.retos.filter((r) => mias.has(r.id)).length;
    v.hechos.textContent = hechos;
    info.retos.forEach((x, i) => v.tira.children[i]?.classList.toggle('lleno', mias.has(x.id) || !!previas[x.id]));
    const abierto = est.abierto;
    v.subRetos.textContent = !abierto ? 'El concurso cerró. Gracias por jugar: mira el ranking final.'
      : sesion.demo ? 'Así ve los retos una invitada. En la boda real, cada reto abre la cámara.'
      : 'Una foto por reto. Puedes cambiarla cuando quieras.';
    const r = relampagoActivo();
    pintarSiguiente(mias, r, abierto);
    if ((r?.id || null) !== (v.relampago.dataset.id ? Number(v.relampago.dataset.id) : null)) {
      v.relampago.dataset.id = r?.id || '';
      v.relampago.replaceChildren(...(r ? [el('div', { class: 'relampago', role: 'status' }, ico('lightning-fill'),
        el('div', {}, el('b', { texto: `Reto relámpago: ${r.titulo}` }), el('small', { texto: 'Vale el doble mientras dure' })),
        el('span', { class: 'reloj', 'data-hasta': r.relampago_hasta, texto: reloj(r.relampago_hasta) }))] : []));
    }
    // Trivia como reto especial
    const conTrivia = info.modulos.includes('trivia') && info.trivia.length;
    const triviaHecha = est.yo?.trivia_hecha;
    v.trivia.replaceChildren(...(conTrivia ? [el('button', { class: 'tarjeta-trivia', style: 'margin-bottom:16px', onclick: abrirTrivia },
      el('div', {}, el('b', { texto: '¿Cuánto conoces a los novios?' }),
        el('small', { texto: triviaHecha ? `Ya jugaste: ${est.yo.puntos_trivia} puntos` : `${info.trivia.length} preguntas · hasta ${info.trivia.length * 5} puntos` })),
      ico(triviaHecha ? 'check' : 'arrow-right'))] : []));
    const relId = r?.id;
    reconciliar(v.rollo, info.retos, (x) => x.id, crearCuadro, (n, x, i) => actualizarCuadro(n, x, i, mias.get(x.id), relId === x.id, abierto));
  }

  // Tarjeta destacada: el próximo reto por cumplir (el relámpago tiene prioridad)
  function pintarSiguiente(mias, rel, abierto) {
    const pendiente = (x) => !mias.has(x.id) && !previas[x.id];
    const sig = (rel && pendiente(rel) ? info.retos.find((x) => x.id === rel.id) : null) || info.retos.find(pendiente);
    const doble = !!(rel && sig && rel.id === sig.id);
    const clave = !abierto ? 'cerrado' : sig ? `${sig.id}:${doble}` : 'fin';
    if (v.siguiente.dataset.k === clave) return;
    v.siguiente.dataset.k = clave;
    if (!abierto) return v.siguiente.replaceChildren();
    if (!sig) return v.siguiente.replaceChildren(el('article', { class: 'destacado' },
      el('p', { class: 'destacado-eti', texto: 'Rollo completo' }),
      el('h3', { class: 'destacado-titulo', texto: 'Cumpliste todos los retos' }),
      el('p', { class: 'destacado-desc', texto: 'Puedes cambiar cualquier foto cuando quieras. Mira cómo vas en el ranking.' })));
    const n = String(info.retos.indexOf(sig) + 1).padStart(2, '0');
    v.siguiente.replaceChildren(el('article', { class: 'destacado' + (doble ? ' doble' : '') },
      el('p', { class: 'destacado-eti', texto: doble ? `Reto relámpago · Nº ${n}` : `Tu siguiente reto · Nº ${n}` }),
      el('h3', { class: 'destacado-titulo', texto: sig.titulo }),
      sig.descripcion ? el('p', { class: 'destacado-desc', texto: sig.descripcion }) : null,
      el('div', { class: 'destacado-pie' },
        el('span', { class: 'pts', texto: doble ? `${sig.puntos * 2} puntos, solo por ahora` : `${sig.puntos} puntos` }),
        el('button', { class: 'btn', onclick: () => elegir(sig.id) }, ico('camera'), 'Tomar la foto'))));
    if (!reducir.matches) v.siguiente.firstChild.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }

  function crearCuadro(r, i) {
    const n = el('div', { class: 'cuadro' });
    n._media = el('button', { class: 'cuadro-media', onclick: () => elegir(r.id) });
    n._num = el('span', { class: 'cuadro-num', 'aria-hidden': 'true', texto: `Nº ${String(i + 1).padStart(2, '0')}` });
    // El marco vacío muestra la consigna del reto, como una tarjeta de mesa
    n._desc = el('span', { class: 'cuadro-desc', 'aria-hidden': 'true' });
    n._cta = el('span', { class: 'cuadro-cta', 'aria-hidden': 'true' }, ico('camera-plus'));
    n._estado = el('div', { class: 'cuadro-estado oculto' });
    n._media.append(n._num, n._desc, n._cta, n._estado);
    n._pts = el('span', { class: 'pts' });
    n._marca = el('span', {});
    n.append(n._media, el('div', { class: 'cuadro-titulo', texto: r.titulo }), el('div', { class: 'cuadro-pie' }, n._pts, n._marca));
    return n;
  }

  function actualizarCuadro(n, r, i, f, doble, abierto) {
    const pct = subiendo[r.id];
    const src = previas[r.id] || (f && est.galeriaVisible ? fotoUrl(f.id, 'm') : null);
    const hecho = !!f || !!previas[r.id];
    n.classList.toggle('hecho', hecho);
    n.classList.toggle('doble', doble && abierto);
    if (src && n._img?.dataset.src !== src) {
      const nueva = el('img', { alt: '', 'data-src': src });
      if (n._revelar) { nueva.classList.add('revelando'); n._revelar = false; }
      nueva.src = src;
      (n._img ? n._img.replaceWith(nueva) : n._media.prepend(nueva));
      n._img = nueva;
      if (!n._sello && info.fecha && info.desechable) { n._sello = el('span', { class: 'sello', 'aria-hidden': 'true', texto: fechaSello(info.fecha) }); n._media.append(n._sello); }
    }
    n._num.hidden = !!src;
    n._desc.textContent = r.descripcion || r.titulo;
    n._desc.hidden = hecho;
    n._cta.hidden = hecho || !abierto;
    let estado = null;
    if (pct != null) estado = [el('div', { class: 'barra-progreso' }, el('i', { style: `transform:scaleX(${pct / 100})` })), el('span', { texto: pct < 100 ? `Subiendo ${pct}%` : 'Revelando…' })];
    else if (pendientes.has(r.id)) estado = [ico('wifi-slash'), el('span', { texto: 'Se subirá sola cuando vuelva la señal' })];
    else if (hecho && !src) estado = [ico('film-strip'), el('span', { texto: 'En el rollo. Se revela al final.' })];
    n._estado.classList.toggle('oculto', !estado);
    if (estado) n._estado.replaceChildren(...estado);
    n._pts.textContent = f ? `+${f.puntos} pts` : doble && abierto ? `${r.puntos * 2} pts ahora` : `${r.puntos} pts`;
    n._marca.replaceChildren(hecho ? ico('check') : document.createTextNode(''));
    n._media.setAttribute('aria-label', `${r.titulo}. ${r.descripcion || ''} ${hecho ? 'Cumplido. Toca para cambiar la foto.' : abierto ? 'Toca para subir tu foto.' : 'Concurso cerrado.'}`);
  }

  function elegir(retoId) {
    if (sesion.demo) return aviso('En la demo no se suben fotos. En la boda real se abre la cámara aquí.');
    if (!est.abierto) return aviso('El concurso ya cerró', true);
    retoElegido = retoId;
    archivo.value = '';
    archivo.click();
  }

  archivo.addEventListener('change', async () => {
    const file = archivo.files?.[0];
    const retoId = retoElegido;
    if (!file || !retoId) return;
    subiendo[retoId] = 0; actualizarRetos();
    try {
      const [foto, mini] = await Promise.all([comprimir(file, 1600, 0.82), comprimir(file, 420, 0.7)]);
      if (previas[retoId]) URL.revokeObjectURL(previas[retoId]);
      previas[retoId] = URL.createObjectURL(mini);
      await enviar({ k: `${codigo}-${retoId}`, codigo, reto: retoId, foto, mini });
    } catch (e) { delete subiendo[retoId]; aviso(e.message || 'No pudimos procesar la foto', true); actualizarRetos(); }
  });

  function disparoFlash() {
    if (reducir.matches) return;
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
  }

  function enviar(item, silencioso = false) {
    return new Promise((ok) => {
      const fd = new FormData();
      fd.append('token', sesion.token);
      fd.append('reto', item.reto);
      fd.append('foto', item.foto, 'foto.jpg');
      fd.append('mini', item.mini, 'mini.jpg');
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/revelado/api/e/${codigo}/fotos`);
      let ultimo = 0;
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable || silencioso) return;
        subiendo[item.reto] = Math.round((e.loaded / e.total) * 100);
        if (Date.now() - ultimo > 120) { ultimo = Date.now(); actualizarRetos(); }
      };
      xhr.onload = async () => {
        delete subiendo[item.reto];
        let r = {};
        try { r = JSON.parse(xhr.responseText); } catch { /* vacío */ }
        if (xhr.status >= 200 && xhr.status < 300) {
          pendientes.delete(item.reto);
          await cola.quitar(item.k);
          const cuadro = [...v.rollo.children].find((x) => x.dataset.k === String(item.reto));
          if (cuadro) { cuadro._revelar = true; if (cuadro._img) cuadro._img.dataset.src = ''; }
          disparoFlash();
          aviso(`+${r.puntos} puntos${r.reemplazo ? ' · foto cambiada' : ''}`);
          await refrescar();
        } else if (xhr.status >= 500 || xhr.status === 429) {
          await encolar(item);
        } else {
          pendientes.delete(item.reto);
          await cola.quitar(item.k);
          aviso(r.error || 'No se pudo subir la foto', true);
        }
        actualizar();
        ok();
      };
      xhr.onerror = async () => { delete subiendo[item.reto]; await encolar(item); actualizar(); ok(); };
      xhr.send(fd);
    });
  }

  async function encolar(item) {
    pendientes.add(item.reto);
    await cola.poner(item);
    aviso('Sin señal: tu foto se subirá sola cuando vuelva la conexión');
  }

  let reintentando = false;
  async function reintentarCola() {
    if (reintentando || !sesion?.token) return;
    reintentando = true;
    try {
      const items = await cola.todos();
      for (const it of items) pendientes.add(it.reto);
      if (items.length && navigator.onLine !== false) for (const it of items) await enviar(it, true);
    } finally { reintentando = false; }
  }
  addEventListener('online', reintentarCola);
  setInterval(reintentarCola, 20000);

  // ---------- ranking ----------
  function actualizarRanking() {
    const rank = est.ranking || [];
    const premios = est.premios || info.premios || [];
    v.tituloRank.textContent = est.abierto ? 'Ranking' : 'Ranking final';
    v.subRank.textContent = `${est.totales.invitados} invitados jugando · ${est.totales.fotos} fotos`;
    const yoId = est.yo?.id;
    const firma = rank.slice(0, 3).map((p) => p.id + ':' + p.puntos).join('|') + premios.join('|') + yoId;
    if (v.podio.dataset.firma !== firma) {
      v.podio.dataset.firma = firma;
      v.podio.replaceChildren(...[1, 0, 2].map((i) => {
        const p = rank[i];
        return el('div', { class: `podio-puesto p${i + 1}` },
          el('span', { class: 'podio-n', texto: String(i + 1) }),
          el('span', { class: 'podio-quien', texto: p ? (p.id === yoId ? `${p.nombre} (tú)` : p.nombre) : 'Libre' }),
          el('span', { class: 'podio-pts', texto: p ? `${p.puntos} pts` : '¿Tú?' }),
          premios[i] ? el('span', { class: 'podio-premio', texto: premios[i] }) : null);
      }));
    }
    const resto = rank.slice(3);
    reconciliar(v.lista, resto, (p) => p.id, () => {
      const n = el('div', { class: 'fila-rank' });
      n._pos = el('span', { class: 'pos' }); n._quien = el('b', {}); n._mesa = el('small', {}); n._pts = el('span', { class: 'pts' });
      n.append(n._pos, el('span', { class: 'quien' }, n._quien, n._mesa), n._pts);
      return n;
    }, (n, p, i) => {
      const pos = i + 4;
      n._pos.textContent = pos; n._quien.textContent = p.nombre; n._mesa.textContent = p.mesa ? `Mesa ${p.mesa}` : ''; n._pts.textContent = p.puntos;
      n.classList.toggle('yo', p.id === yoId);
      const antes = posPrevias.get(p.id);
      if (antes && antes > pos) { n.classList.remove('subio'); void n.offsetWidth; n.classList.add('subio'); }
    }, { flip: true });
    posPrevias = new Map(rank.map((p, i) => [p.id, i + 1]));
    if (!rank.length) v.lista.replaceChildren(el('div', { class: 'vacio' }, el('b', { texto: 'Nadie ha sumado todavía' }), el('span', { texto: 'Sube la primera foto y encabeza la tabla.' })));
  }

  // ---------- álbum ----------
  function actualizarAlbum() {
    const nombreReto = (id) => info.retos.find((r) => r.id === id)?.titulo || '';
    if (!est.galeriaVisible) {
      v.muro.replaceChildren();
      v.subAlbum.textContent = '';
      if (!v.cerrado.firstChild || v.cerrado.dataset.n !== String(est.totales.fotos)) {
        v.cerrado.dataset.n = est.totales.fotos;
        v.cerrado.replaceChildren(el('div', { class: 'rollo-cerrado' }, ico('film-strip'),
          el('b', { texto: `${est.totales.fotos} fotos en el rollo` }),
          el('p', { texto: 'Como en una cámara desechable, el álbum se revela cuando los novios lo decidan. Sigue sumando.' })));
      }
      return;
    }
    v.cerrado.replaceChildren();
    const fotos = est.fotos || [];
    v.subAlbum.textContent = `${est.totales.fotos} fotos de los invitados`;
    const lista = () => fotos.map((f) => ({ src: fotoUrl(f.id, 'g'), descarga: fotoUrl(f.id, 'g', '?descargar=1'), alt: `${f.nombre}: ${nombreReto(f.reto_id)}`, f }));
    reconciliar(v.muro, fotos, (f) => f.id, (f) => {
      const img = el('img', { alt: `${f.nombre}: ${nombreReto(f.reto_id)}`, loading: 'lazy', decoding: 'async' });
      img.addEventListener('load', () => img.classList.add('cargada'), { once: true });
      img.src = fotoUrl(f.id, 'm');
      const b = el('button', { 'aria-label': `Ver foto de ${f.nombre}` }, img, info.fecha && info.desechable ? el('span', { class: 'sello', 'aria-hidden': 'true', texto: fechaSello(info.fecha) }) : null);
      // Pie de foto documental con datos reales: número de foto, hora y mesa
      const pie = (x) => [el('b', { texto: x.f.nombre }), el('br'), el('small', { texto: nombreReto(x.f.reto_id) }), el('br'),
        el('span', { class: 'foto-meta', texto: [`Foto ${x.f.n}`, hora(x.f.creado), x.f.mesa ? `Mesa ${x.f.mesa}` : ''].filter(Boolean).join(' · ') })];
      b.addEventListener('click', () => { const l = lista(); visor(l, l.findIndex((x) => x.f.id === f.id), pie); });
      return b;
    });
    if (!fotos.length) v.cerrado.replaceChildren(el('div', { class: 'vacio' }, el('b', { texto: 'Aún no hay fotos' }), el('span', { texto: 'Las primeras aparecerán aquí al instante.' })));
  }

  // ---------- firmas ----------
  function actualizarFirmas() {
    reconciliar(v.firmas, est.firmas || [], (f) => f.id, (f) => el('div', { class: 'firma' }, el('p', { texto: f.texto }), el('small', { texto: f.nombre })));
  }

  // ---------- mesa ----------
  function abrirMesa() {
    const res = el('div', { 'aria-live': 'polite' });
    let t;
    const inp = el('input', { class: 'input', id: 'buscar-mesa', autocomplete: 'off', placeholder: 'Ej. Quispe', oninput: () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        if (inp.value.trim().length < 3) return res.replaceChildren();
        try {
          const r = await api(`/e/${codigo}/mesa?q=${encodeURIComponent(inp.value)}`);
          res.replaceChildren(...(r.resultados.length ? r.resultados.map((x) => el('div', { class: 'resultado-mesa' }, el('span', { texto: x.nombre }), el('b', { texto: `Mesa ${x.mesa}` })))
            : [el('p', { class: 'suave', texto: 'No te encontramos. Prueba solo con tu apellido o pregunta al anfitrión.' })]));
        } catch (e) { aviso(e.message, true); }
      }, 280);
    } });
    hoja(el('div', {}, el('h2', { class: 'display', texto: 'Encuentra tu mesa' }),
      el('label', { class: 'campo', for: 'buscar-mesa', style: 'margin-top:12px' }, el('span', { texto: 'Tu nombre o apellido' }), inp), res), { titulo: 'Encuentra tu mesa' });
  }

  // ---------- trivia: una pregunta por pantalla ----------
  function abrirTrivia() {
    const qs = info.trivia;
    const cont = el('div', {});
    const h = hoja(cont, { titulo: 'Trivia de los novios' });
    if (est.yo?.trivia_hecha) {
      cont.append(el('h2', { class: 'display', texto: 'Ya jugaste' }), el('p', { class: 'suave', texto: `Sumaste ${est.yo.puntos_trivia} puntos con la trivia.` }), el('button', { class: 'btn ancho', onclick: h.cerrar }, 'Volver a los retos'));
      return;
    }
    const resp = {};
    let i = 0;
    const pintar = () => {
      const q = qs[i];
      cont.replaceChildren(
        el('div', { class: 'trivia-paso', texto: `Pregunta ${i + 1} de ${qs.length}` }),
        el('p', { class: 'trivia-pregunta', texto: q.pregunta }),
        ...q.opciones.map((o, j) => el('button', { class: 'opcion', onclick: async (e) => {
          resp[q.id] = j;
          e.currentTarget.classList.add('sel');
          await new Promise((r) => setTimeout(r, reducir.matches ? 0 : 220));
          if (i < qs.length - 1) { i++; pintar(); } else terminar();
        } }, el('span', { texto: o }))));
      cont.querySelector('.opcion')?.focus({ preventScroll: true });
    };
    const terminar = async () => {
      if (sesion.demo) {
        cont.replaceChildren(el('h2', { class: 'display', texto: 'Así termina la trivia' }), el('p', { class: 'suave', texto: 'En la boda real aquí ves tus aciertos y los puntos suben al ranking al instante.' }), el('button', { class: 'btn ancho', onclick: h.cerrar }, 'Entendido'));
        return;
      }
      cont.replaceChildren(el('p', { class: 'suave', texto: 'Calculando…' }));
      try {
        const r = await postJSON(`/e/${codigo}/trivia`, { token: sesion.token, respuestas: resp });
        const n = el('div', { class: 'trivia-puntaje', texto: '0' });
        cont.replaceChildren(el('h2', { class: 'display', texto: `Acertaste ${r.aciertos} de ${r.total}` }), n, el('p', { class: 'suave', texto: 'puntos para el ranking' }), el('button', { class: 'btn ancho', style: 'margin-top:16px', onclick: h.cerrar }, 'Seguir con los retos'));
        contar(n, r.puntos);
        await refrescar(); actualizar();
      } catch (e) { cont.replaceChildren(el('p', { class: 'error-campo', texto: e.message }), el('button', { class: 'btn ancho', onclick: h.cerrar }, 'Cerrar')); }
    };
    pintar();
  }

  // Vista previa de paletas desde el panel o la web (misma página de origen, sin recargar)
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.tipo !== 'tema' || !TEMAS[e.data.tema] || !info) return;
    info.tema = e.data.tema; info.previa = true; aplicarTema(e.data.tema);
  });

  // ---------- refresco periódico ----------
  setInterval(async () => {
    if (document.visibilityState !== 'visible' || !sesion || !info || !v.vistas || document.querySelector('.visor')) return;
    await refrescar();
    if (sesion) actualizar();
  }, 5000);
  setInterval(() => { for (const r of document.querySelectorAll('.reloj[data-hasta]')) r.textContent = reloj(Number(r.dataset.hasta)); }, 1000);

  iniciar();
})();
