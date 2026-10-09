// Pantalla gigante: fotos que van llegando + ranking en vivo + QR. Al cerrar el concurso, podio revelado por puestos.
(() => {
  const { codigo, api, el, ico, qr, urlInvitado, fotoUrl, fechaSello, reducir, urlCorta } = FV;
  const $ = (id) => document.getElementById(id);
  const ALTO = 9.4; // alto de cada fila del ranking, en vh (fila + separación)
  const FILAS = 5; // a 10 m se leen mejor cinco nombres grandes que ocho chicos
  const LOTE_MS = 20000; // el ranking se reordena en lotes, no con cada foto (criterio del benchmark)
  let info, est, cola = [], i = 0, capa = 'A', posPrev = new Map(), podioMostrado = false, avisoT, relojT, ultimoOrden = 0;
  const vistos = new Set();
  const hora = (t) => new Date(t).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });

  // La pantalla siempre es oscura (se proyecta): el acento se elige y aclara para leerse sobre negro
  function temaPantalla(id) {
    const t = aplicarTema(id);
    const raiz = document.documentElement;
    const p = acentoPantalla(t);
    raiz.style.setProperty('--c-acento', p.color);
    raiz.style.setProperty('--c-acento-txt', p.texto);
    raiz.dataset.modo = 'oscuro';
  }

  async function iniciar() {
    try { info = await api('/e/' + codigo); }
    catch { $('espera').replaceChildren(el('b', { texto: 'No encontramos este evento' }), el('span', { texto: 'Revisa el enlace de la pantalla.' })); return; }
    temaPantalla(info.tema);
    $('nombres').textContent = info.nombres;
    $('mono').textContent = monograma(info.nombres);
    document.title = `${info.nombres} · Pantalla en vivo`;
    qr($('qr'), urlInvitado(codigo, info));
    $('url').textContent = urlCorta(urlInvitado(codigo, info));
    await refrescar();
    setInterval(refrescar, 4000);
    setInterval(siguiente, 7000);
    siguiente();
    document.addEventListener('click', () => document.documentElement.requestFullscreen?.().catch(() => {}));
  }

  async function refrescar() {
    try { est = await api(`/e/${codigo}/estado?n=150`); } catch { return; }
    if (est.tema && est.tema !== info.tema) { info.tema = est.tema; temaPantalla(est.tema); }
    $('meta').replaceChildren(info.fecha && info.desechable ? el('span', { class: 'sello', texto: fechaSello(info.fecha) }) : '',
      el('span', { texto: `${est.totales.invitados} invitados · ${est.totales.fotos} fotos` }));
    const primera = vistos.size === 0;
    const nuevas = (est.fotos || []).filter((f) => !vistos.has(f.id)); // vienen de la más nueva a la más antigua
    for (const f of [...nuevas].reverse()) { vistos.add(f.id); cola.splice(i % (cola.length + 1), 0, f); }
    if (!primera && nuevas.length) avisarNueva(nuevas[0], nuevas.length);
    const visibles = new Set((est.fotos || []).map((f) => f.id)); // si los novios ocultan una foto, sale de la rotación
    cola = cola.filter((f) => visibles.has(f.id));
    if (cola.length && i > cola.length) i = 0;
    if (!ultimoOrden || Date.now() - ultimoOrden >= LOTE_MS || !est.abierto) { pintarRanking(); ultimoOrden = Date.now(); }
    pintarRelampago();
    pintarAviso();
    pintarPodio();
  }

  function avisarNueva(f, n) {
    const a = $('nueva');
    a.replaceChildren(ico('camera'), el('span', { texto: n > 1 ? `${n} fotos nuevas` : `Nueva foto de ${f.nombre}` }));
    a.classList.add('ver');
    clearTimeout(avisoT);
    avisoT = setTimeout(() => a.classList.remove('ver'), 3600);
  }

  function siguiente() {
    const espera = $('espera');
    if (!est?.galeriaVisible) {
      espera.replaceChildren(el('b', { texto: 'El rollo se revela al final de la fiesta' }), el('span', { texto: `${est?.totales?.fotos ?? 0} fotos esperando. Sigan sumando retos.` }));
      espera.hidden = false;
      $('capaA').classList.remove('ver'); $('capaB').classList.remove('ver'); $('leyenda').replaceChildren();
      return;
    }
    if (!cola.length) { espera.hidden = false; return; }
    const f = cola[i % cola.length];
    i = (i + 1) % cola.length;
    const src = fotoUrl(f.id, 'g');
    const pre = new Image();
    pre.onload = () => {
      espera.hidden = true;
      const entra = $(capa === 'A' ? 'capaB' : 'capaA');
      const sale = $(capa === 'A' ? 'capaA' : 'capaB');
      entra.querySelector('.fondo').src = src;
      entra.querySelector('.foto').src = src;
      entra.querySelector('.foto').alt = `Foto de ${f.nombre}`;
      entra.classList.remove('ver'); void entra.offsetWidth;
      entra.classList.add('ver'); sale.classList.remove('ver');
      capa = capa === 'A' ? 'B' : 'A';
      const reto = info.retos.find((r) => r.id === f.reto_id)?.titulo || '';
      // Pie de foto documental con datos reales de la noche
      const meta = [`Foto ${f.n}`, hora(f.creado), f.mesa ? `Mesa ${f.mesa}` : ''].filter(Boolean).join(' · ');
      $('leyenda').replaceChildren(el('div', {}, el('b', { texto: f.nombre }), el('span', { texto: reto }), el('span', { class: 'foto-meta', texto: meta })),
        info.fecha && info.desechable ? el('span', { class: 'sello', texto: fechaSello(info.fecha) }) : '');
    };
    pre.src = src;
  }

  function pintarRanking() {
    const cont = $('rank');
    const top = (est.ranking || []).slice(0, FILAS);
    const actuales = new Map([...cont.querySelectorAll('.fila-pant')].map((n) => [n.dataset.k, n]));
    top.forEach((p, idx) => {
      let n = actuales.get(p.id);
      if (!n) {
        n = el('div', { class: 'fila-pant' }, el('span', { class: 'pos' }), el('span', { class: 'quien' }), el('span', { class: 'pts' }));
        n.dataset.k = p.id;
        n.style.transform = `translateY(${idx * ALTO}vh)`;
        n.style.opacity = '0';
        cont.append(n);
        requestAnimationFrame(() => { n.style.opacity = '1'; });
      }
      actuales.delete(p.id);
      n.children[0].textContent = idx + 1;
      n.children[1].textContent = p.nombre;
      n.children[2].textContent = p.puntos;
      n.style.transform = `translateY(${idx * ALTO}vh)`;
      n.classList.toggle('lider', idx === 0);
      const antes = posPrev.get(p.id);
      if (antes != null && antes > idx) { n.classList.add('subio'); setTimeout(() => n.classList.remove('subio'), 1600); }
    });
    for (const n of actuales.values()) n.remove();
    posPrev = new Map(top.map((p, idx) => [p.id, idx]));
    cont.querySelector('.vacio-pant')?.remove();
    if (!top.length) cont.append(el('p', { class: 'vacio-pant suave', style: 'font-size:2.2vh', texto: 'El ranking empieza con la primera foto.' }));
  }

  // Aviso de actividad (Premium): cartel grande durante 2 minutos desde que se envía
  const ICONOS_AVISO = { baile: 'music-notes', torta: 'cake', bar: 'martini', horaloca: 'confetti', ramo: 'flower', brindis: 'champagne', cena: 'fork-knife' };
  let avisoT2;
  function pintarAviso() {
    const caja = $('aviso');
    const a = est.aviso;
    const vigente = a && Date.now() - a.creado < 120000;
    if (!vigente) { caja.classList.remove('ver'); caja.dataset.k = ''; return; }
    if (caja.dataset.k === String(a.id)) return;
    caja.dataset.k = String(a.id);
    caja.replaceChildren(ico(ICONOS_AVISO[a.tipo] || 'megaphone'), el('div', {}, el('b', { texto: a.titulo }), a.cuerpo ? el('span', { texto: a.cuerpo }) : ''));
    caja.classList.add('ver');
    clearTimeout(avisoT2);
    avisoT2 = setTimeout(() => caja.classList.remove('ver'), Math.max(5000, 120000 - (Date.now() - a.creado)));
  }

  function pintarRelampago() {
    const f = $('flash');
    const r = est.relampago;
    clearInterval(relojT);
    if (!r || r.relampago_hasta <= Date.now()) { f.classList.remove('ver'); return; }
    const reloj = el('span', { class: 'reloj' });
    const tic = () => { const s = Math.max(0, Math.round((r.relampago_hasta - Date.now()) / 1000)); reloj.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    tic(); relojT = setInterval(tic, 1000);
    f.replaceChildren(el('div', {}, el('b', { texto: `Reto relámpago: ${r.titulo}` }), el('span', { texto: 'Vale el doble mientras dure' })), reloj);
    f.classList.add('ver');
  }

  function pintarPodio() {
    const p = $('podio');
    if (est.abierto) { p.classList.remove('ver'); podioMostrado = false; return; }
    if (podioMostrado) return;
    podioMostrado = true;
    const top = (est.ranking || []).slice(0, 3);
    const premios = est.premios || [];
    const puestos = [1, 0, 2].filter((k) => top[k]).map((k) => el('div', { class: 'puesto-pant' + (k === 0 ? ' primero' : ''), 'data-k': k },
      el('span', { class: 'n', texto: String(k + 1) }),
      el('span', { class: 'q', texto: top[k].nombre }),
      el('span', { class: 'p', texto: `${top[k].puntos} puntos · ${top[k].fotos} fotos` }),
      premios[k] ? el('span', { class: 'pr', texto: premios[k] }) : ''));
    p.replaceChildren(el('h1', { class: 'display', texto: info.nombres }), el('div', { class: 'sub', texto: 'Ganadores de los retos' }), el('div', { class: 'puestos-pant' }, puestos));
    p.classList.add('ver');
    // Se revela del tercero al primero, como en una premiación
    const orden = [2, 1, 0];
    orden.forEach((k, n) => setTimeout(() => p.querySelector(`[data-k="${k}"]`)?.classList.add('ver'), reducir.matches ? 0 : 700 + n * 1100));
  }

  iniciar();
})();
