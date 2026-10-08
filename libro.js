// Libro de Reclamaciones: valida, envía y muestra la constancia (hoja de reclamación) para imprimir o guardar.
(() => {
  const { postJSON, el } = FV;
  const $ = (id) => document.getElementById(id);
  const fecha = (t = Date.now()) => new Date(t).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' });
  $('hoy').textContent = fecha();

  $('form-libro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const d = Object.fromEntries(new FormData(f));
    $('libro-error').textContent = '';
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const r = await postJSON('/reclamos', d);
      f.hidden = true;
      const fila = (k, v) => v ? el('tr', {}, el('th', { texto: k }), el('td', { texto: v })) : null;
      $('constancia').replaceChildren(
        el('h2', { texto: `Hoja de reclamación ${r.codigo}` }),
        el('p', { texto: `Registrada el ${fecha(r.creado)}. Guarda o imprime esta constancia: es tu comprobante.` }),
        el('table', {}, el('tbody', {},
          fila('Proveedor', 'Nelson Bernal Cubillas'),
          fila('Código', r.codigo),
          fila('Nombre', r.nombre), fila('Documento', `${r.doc_tipo} ${r.doc_numero}`), fila('Domicilio', r.domicilio),
          fila('Correo', r.correo), fila('Teléfono', r.telefono), fila('Madre, padre o tutor', r.apoderado),
          fila('Tipo de bien', r.bien_tipo), fila('Monto reclamado', r.monto ? `S/ ${r.monto}` : ''), fila('Descripción', r.bien_descripcion),
          fila('Tipo', r.tipo === 'queja' ? 'Queja' : 'Reclamo'), fila('Detalle', r.detalle), fila('Pedido', r.pedido))),
        el('p', { class: 'suave', style: 'margin-top:16px', texto: 'Te responderemos por correo en un plazo máximo de 15 días hábiles improrrogables.' }),
        el('button', { class: 'btn', style: 'margin-top:12px', onclick: () => print() }, 'Imprimir o guardar en PDF'));
      $('constancia').hidden = false;
      $('constancia').scrollIntoView({ behavior: 'smooth' });
    } catch (er) { $('libro-error').textContent = er.message; btn.disabled = false; }
  });
})();
