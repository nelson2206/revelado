// Web de socios: revelado al hacer scroll, demos en vivo escaladas, selector de paletas, video y formulario.
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Revelado al entrar en pantalla (una sola vez por elemento)
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('[data-revelar]').forEach((n) => io.observe(n));

  // Borde de la barra al hacer scroll (sin escuchar el evento scroll)
  new IntersectionObserver(([e]) => $('.nav').classList.toggle('borde', !e.isIntersecting)).observe($('#tope'));

  // Las demos en vivo se dibujan a tamaño real (375 o 1280 px) y se escalan al marco
  const ro = new ResizeObserver((es) => es.forEach(({ target }) => {
    const f = target.querySelector('iframe');
    if (f) f.style.transform = `scale(${target.clientWidth / Number(f.dataset.escala || 375)})`;
  }));
  $$('.telefono, .tv, .telefono-solo').forEach((m) => { m.querySelector('iframe').dataset.escala ||= '375'; ro.observe(m); });

  // Selector de paletas: la app de la demo cambia sin recargar
  const tel = $('#tel-paletas');
  const muestras = $('#muestras');
  let actual = 'medianoche';
  const enviar = () => tel.contentWindow?.postMessage({ tipo: 'tema', tema: actual }, location.origin);
  tel.addEventListener('load', () => setTimeout(enviar, 400));
  Object.entries(TEMAS).forEach(([id, t]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'muestra';
    b.setAttribute('aria-pressed', id === actual ? 'true' : 'false');
    b.innerHTML = `<span class="muestra-color" aria-hidden="true"><i></i><i></i></span><b></b>`;
    const [a, c] = b.querySelectorAll('i');
    a.style.cssText = `background:${t.c.fondo};color:${t.c.texto};font-family:${t.tipo === 'clasico' ? 'Newsreader, Georgia, serif' : 'Geist, sans-serif'}`;
    a.textContent = 'Aa';
    c.style.background = t.c.acento;
    b.querySelector('b').textContent = t.nombre;
    b.addEventListener('click', () => {
      actual = id;
      for (const x of muestras.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      enviar();
    });
    muestras.append(b);
  });

  // Video: solo corre cuando se ve; botón de pausa siempre disponible
  const v = $('#video'), vb = $('#video-btn');
  let pausadoPorUsuario = reducir;
  const icono = () => { vb.querySelector('use').setAttribute('href', `/revelado/iconos.svg#i-${v.paused ? 'play' : 'pause'}`); vb.setAttribute('aria-label', v.paused ? 'Reproducir video' : 'Pausar video'); };
  vb.addEventListener('click', () => { if (v.paused) { pausadoPorUsuario = false; v.play().catch(() => {}); } else { pausadoPorUsuario = true; v.pause(); } });
  v.addEventListener('play', icono); v.addEventListener('pause', icono);
  new IntersectionObserver(([e]) => { if (e.isIntersecting && !pausadoPorUsuario) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.4 }).observe(v);
  icono();

  // La cifra del socio sube al aparecer (historia: lo que gana por boda)
  const cifra = $('#cifra');
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return;
    o.disconnect();
    if (reducir) return;
    const hasta = Number(cifra.dataset.hasta), t0 = performance.now();
    const paso = (t) => { const p = Math.min(1, (t - t0) / 900); cifra.textContent = Math.round(hasta * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }, { threshold: 0.6 }).observe(cifra);

  // Los botones de "Reservar fecha" y "Quiero ser socio" preseleccionan el tipo en el formulario
  $$('a[data-tipo]').forEach((a) => a.addEventListener('click', () => { $('#tipo').value = a.dataset.tipo; }));

  // Formulario de contacto
  const form = $('#form'), estado = $('#form-estado');
  // Vitrina sin servidor: en vez del formulario, el correo directo (no se envían datos a ningún lado)
  if (document.querySelector('meta[name="vitrina"]')) {
    const correo = 'nelson.bernalcu@gmail.com';
    form.replaceChildren(Object.assign(document.createElement('div'), { className: 'form-ok', innerHTML:
      `<h3>Escríbenos y te mostramos la demo en vivo</h3><p class="suave">Cuéntanos qué eventos organizas y cuántos al año. Respondemos con los precios de socio y una prueba gratis en tu próximo evento.</p><a class="btn" href="mailto:${correo}?subject=Quiero%20ser%20socio%20de%20Revelado">${correo}</a>` }));
    return;
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    estado.className = 'form-estado';
    const d = Object.fromEntries(new FormData(form));
    if ((d.nombre || '').trim().length < 2) { estado.textContent = 'Escribe tu nombre.'; estado.classList.add('error'); form.nombre.focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(d.correo || '')) { estado.textContent = 'Revisa tu correo: parece incompleto.'; estado.classList.add('error'); form.correo.focus(); return; }
    if (!form.consiento.checked) { estado.textContent = 'Marca la autorización para que podamos responderte.'; estado.classList.add('error'); form.consiento.focus(); return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    estado.textContent = 'Enviando…';
    try {
      const r = await fetch('/revelado/api/contacto', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...d, consiento: true, novedades: form.novedades.checked }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo enviar. Inténtalo de nuevo.');
      form.replaceChildren(Object.assign(document.createElement('div'), { className: 'form-ok', innerHTML: '<svg class="icono" aria-hidden="true"><use href="/revelado/iconos.svg#i-check-circle"/></svg><h3>Recibimos tu solicitud</h3><p class="suave">Te responderemos pronto por correo con la demo y los precios de socio.</p>' }));
    } catch (er) { estado.textContent = er.message; estado.classList.add('error'); btn.disabled = false; }
  });
})();
