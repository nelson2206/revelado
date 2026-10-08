// Utilidades compartidas: API, DOM, íconos, QR, animaciones (FLIP, contador), hoja inferior y visor.
const FV = (() => {
  const qs = new URLSearchParams(location.search);
  // El código llega por ?c= o, en las direcciones bonitas (/camila-y-joaquin), en la etiqueta <meta name="evento">
  const codigo = (qs.get('c') || document.querySelector('meta[name="evento"]')?.content || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const reducir = matchMedia('(prefers-reduced-motion: reduce)');

  // Vitrina: copia estática en GitHub Pages (sin servidor). Lee la boda demo de archivos JSON y no guarda nada.
  const VITRINA = document.querySelector('meta[name="vitrina"]')?.content ?? null;
  const CORREO = 'nelson.bernalcu@gmail.com';
  async function apiVitrina(ruta, opts) {
    if (opts.method && opts.method !== 'GET') {
      const e = new Error(ruta === '/reclamos'
        ? `Esta versión de prueba no registra reclamos en línea. Envía tu reclamo o queja a ${CORREO} con los mismos datos y te responderemos en un máximo de 15 días hábiles.`
        : `Esta es una vitrina de demostración: aquí no se guardan datos. Escríbenos a ${CORREO}.`);
      e.status = 403; throw e;
    }
    const m = ruta.match(/^\/e\/DEMO(\/estado|\/mesa)?/);
    if (!m) { const e = new Error('Disponible solo en la versión completa'); e.status = 404; throw e; }
    if (m[1] === '/mesa') {
      const q = new URLSearchParams(ruta.split('?')[1]).get('q') || '';
      const n = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const mesas = await (await fetch(`${VITRINA}/demo/mesas.json`)).json();
      return { resultados: q.length < 3 ? [] : mesas.filter((x) => n(x.nombre).includes(n(q))).slice(0, 8) };
    }
    const r = await fetch(`${VITRINA}/demo/${m[1] ? 'estado' : 'info'}.json`);
    return r.json();
  }

  async function api(ruta, opts = {}) {
    if (VITRINA !== null) return apiVitrina(ruta, opts);
    let r;
    try { r = await fetch('/revelado/api' + ruta, opts); } catch { const e = new Error('Sin conexión. Revisa tu señal e inténtalo otra vez.'); e.red = true; throw e; }
    let data = {};
    try { data = await r.json(); } catch { /* respuesta vacía */ }
    if (!r.ok) { const e = new Error(data.error || 'No se pudo completar la acción'); e.status = r.status; throw e; }
    return data;
  }
  const postJSON = (ruta, body, headers = {}) =>
    api(ruta, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } };
  const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };

  // Crea elementos sin innerHTML (todo texto de usuario va como texto)
  function el(tag, attrs = {}, ...hijos) {
    const n = tag === 'svg' || tag === 'use' ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.setAttribute('class', v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'texto') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const h of hijos.flat(Infinity)) if (h != null && h !== false) n.append(h instanceof Node ? h : document.createTextNode(String(h)));
    return n;
  }
  const ico = (nombre, clase = 'icono') => el('svg', { class: clase, 'aria-hidden': 'true' }, el('use', { href: `/revelado/iconos.svg#i-${nombre}` }));

  let avisoT;
  function aviso(msg, error = false) {
    let a = document.querySelector('.aviso');
    if (!a) { a = el('div', { class: 'aviso', role: 'status', 'aria-live': 'polite' }); document.body.append(a); }
    a.replaceChildren(ico(error ? 'warning' : 'check'), el('span', { texto: msg }));
    a.classList.toggle('error', error);
    requestAnimationFrame(() => a.classList.add('ver'));
    clearTimeout(avisoT);
    avisoT = setTimeout(() => a.classList.remove('ver'), 3200);
  }

  const fechaLarga = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  // Sello de fecha como en las cámaras desechables: 21 11 '26
  const fechaSello = (iso) => { if (!iso) return ''; const [a, m, d] = iso.split('-'); return `${d} ${m} '${a.slice(2)}`; };

  // Reduce la foto en el teléfono: ahorra datos móviles y almacenamiento
  async function comprimir(file, lado, calidad) {
    let fuente;
    try { fuente = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      fuente = await new Promise((ok, mal) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = () => mal(new Error('No pudimos leer la foto. Prueba con otra.'));
        img.src = URL.createObjectURL(file);
      });
    }
    const w = fuente.width, h = fuente.height;
    const f = Math.min(1, lado / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * f); c.height = Math.round(h * f);
    c.getContext('2d').drawImage(fuente, 0, 0, c.width, c.height);
    return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No pudimos procesar la foto'))), 'image/jpeg', calidad));
  }

  // QR vectorial (qrcode-generator, MIT) servido desde /revelado/vendor
  function qr(nodo, texto) {
    nodo.textContent = '';
    if (!window.qrcode) { nodo.append(el('p', { class: 'suave', texto })); return; }
    const q = window.qrcode(0, 'M');
    q.addData(texto);
    q.make();
    nodo.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'Código QR para entrar' });
  }

  // Dirección para el QR: dominio propio > /nombres-de-los-novios > /revelado/e.html?c=CODIGO
  const urlInvitado = (c = codigo, ev = null) => ev?.dominio ? `https://${ev.dominio}` : ev?.slug ? `${location.origin}/${ev.slug}` : `${location.origin}/revelado/e.html?c=${c}`;
  const urlCorta = (u) => u.replace(/^https?:\/\//, '');
  const fotoUrl = (id, tam = 'm', extra = '') => VITRINA !== null ? `${VITRINA}/demo/fotos/${id}-${tam === 'g' ? 'g' : 'm'}.jpg` : `/revelado/api/foto/${encodeURIComponent(id)}/${tam}${extra}`;

  // Lista con claves: reutiliza nodos (no recarga fotos ni rompe animaciones) y anima reordenamientos (FLIP)
  function reconciliar(cont, items, clave, crear, actualizar, { flip = false } = {}) {
    const antes = new Map();
    if (flip && !reducir.matches) for (const n of cont.children) antes.set(n.dataset.k, n.getBoundingClientRect().top);
    const actuales = new Map([...cont.children].map((n) => [n.dataset.k, n]));
    const nuevos = items.map((it, i) => {
      const k = String(clave(it));
      let n = actuales.get(k);
      if (!n) { n = crear(it, i); n.dataset.k = k; }
      actualizar?.(n, it, i);
      actuales.delete(k);
      return n;
    });
    for (const n of actuales.values()) n.remove();
    nuevos.forEach((n, i) => { if (cont.children[i] !== n) cont.insertBefore(n, cont.children[i] || null); });
    if (antes.size) for (const n of nuevos) {
      const y0 = antes.get(n.dataset.k);
      if (y0 == null) continue;
      const dy = y0 - n.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' });
    }
  }

  // Contador que sube hasta el valor nuevo (feedback de puntos)
  function contar(nodo, hasta) {
    const desde = Number(nodo.dataset.v || nodo.textContent) || 0;
    nodo.dataset.v = hasta;
    if (desde === hasta || reducir.matches) { nodo.textContent = hasta; return; }
    const t0 = performance.now(), dur = 520;
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      nodo.textContent = Math.round(desde + (hasta - desde) * e);
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  // Hoja inferior accesible: cierra con Esc o tocando fuera; devuelve el foco
  function hoja(contenido, { titulo } = {}) {
    const previo = document.activeElement;
    const velo = el('div', { class: 'velo' });
    const h = el('div', { class: 'hoja', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo || 'Detalle' }, el('div', { class: 'hoja-asa' }), contenido);
    const cerrar = () => {
      h.classList.remove('ver'); velo.classList.remove('ver');
      removeEventListener('keydown', esc);
      setTimeout(() => { h.remove(); velo.remove(); previo?.focus?.(); }, 260);
    };
    const esc = (e) => { if (e.key === 'Escape') cerrar(); };
    velo.addEventListener('click', cerrar);
    addEventListener('keydown', esc);
    document.body.append(velo, h);
    requestAnimationFrame(() => { velo.classList.add('ver'); h.classList.add('ver'); (h.querySelector('input, button.opcion, textarea') || h).focus?.({ preventScroll: true }); });
    return { cerrar, nodo: h };
  }

  // Visor de fotos con anterior/siguiente (flechas o botones) y descarga
  function visor(lista, i0, pie) {
    let i = i0;
    const previo = document.activeElement;
    const img = el('img', { alt: '' });
    const txt = el('div', {});
    const cerrar = () => { v.classList.remove('ver'); removeEventListener('keydown', tecla); setTimeout(() => { v.remove(); previo?.focus?.(); }, 200); };
    const ir = (d) => { if (lista.length < 2) return; i = (i + d + lista.length) % lista.length; mostrar(); };
    const descargar = el('a', { class: 'btn-icono', 'aria-label': 'Descargar foto', download: '' }, ico('download-simple'));
    function mostrar() {
      const f = lista[i];
      img.src = f.src; img.alt = f.alt || 'Foto';
      descargar.href = f.descarga || f.src;
      txt.replaceChildren(...(pie ? pie(f) : []));
    }
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); if (e.key === 'ArrowRight') ir(1); if (e.key === 'ArrowLeft') ir(-1); };
    const v = el('div', { class: 'visor', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Foto' },
      el('div', { class: 'visor-arriba' }, el('span', { class: 'mono suave', texto: lista.length > 1 ? '' : '' }),
        el('div', { style: 'display:flex;gap:8px' }, descargar, el('button', { class: 'btn-icono', 'aria-label': 'Cerrar', onclick: cerrar }, ico('x')))),
      el('div', { class: 'visor-foto', onclick: (e) => { if (e.target === e.currentTarget) cerrar(); } }, img),
      el('div', { class: 'visor-abajo' },
        lista.length > 1 ? el('button', { class: 'btn-icono', 'aria-label': 'Foto anterior', onclick: () => ir(-1) }, ico('arrow-left')) : el('span'),
        txt,
        lista.length > 1 ? el('button', { class: 'btn-icono', 'aria-label': 'Foto siguiente', onclick: () => ir(1) }, ico('arrow-right')) : el('span')));
    let x0 = null;
    v.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    v.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1); x0 = null; });
    addEventListener('keydown', tecla);
    mostrar();
    document.body.append(v);
    requestAnimationFrame(() => v.classList.add('ver'));
    v.querySelector('button')?.focus({ preventScroll: true });
  }

  return { codigo, api, postJSON, guardar, leer, el, ico, aviso, fechaLarga, fechaSello, comprimir, qr, urlInvitado, fotoUrl, reconciliar, contar, hoja, visor, reducir, urlCorta, VITRINA, CORREO };
})();
