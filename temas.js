// Paletas que eligen los novios. Ocho vienen del benchmark de tendencias de bodas 2026 (Pantone Cloud Dancer,
// Island Citrus de Minted y BRIDES, The Knot 2027, Pinterest 2026) más Medianoche (la de la marca) y Etiqueta.
// Todas pasan WCAG AA en texto, texto secundario y botón. tipo: "moderno" = Geist ligera; "clasico" = Newsreader.
const TEMAS = {
  medianoche: { nombre: 'Medianoche', nota: 'Noche de gala: tinta, marfil y un punto bermellón', modo: 'oscuro', tipo: 'clasico',
    c: { fondo: '#0C0C0D', superficie: '#17171A', texto: '#F2EEE6', texto2: '#A29E96', acento: '#E8603F', acentoTxt: '#160A06', acento2: '#E3C9A6' } },
  jazz: { nombre: 'Club de Jazz', nota: 'Teal de medianoche con rosa, estilo club de jazz', modo: 'oscuro', tipo: 'clasico',
    c: { fondo: '#0B1E24', superficie: '#13303A', texto: '#F2EEE8', texto2: '#A9BDC0', acento: '#E7B8D3', acentoTxt: '#0B1E24', acento2: '#A99CF2' } },
  vendimia: { nombre: 'Vendimia de Noche', nota: 'Ciruela profunda con verde wasabi', modo: 'oscuro', tipo: 'clasico',
    c: { fondo: '#1C0E14', superficie: '#2B1620', texto: '#F6EEE9', texto2: '#C2ABB2', acento: '#C9D96B', acentoTxt: '#1C0E14', acento2: '#BA3E51' } },
  nube: { nombre: 'Nube y Merlot', nota: 'Cloud Dancer, color Pantone 2026, con merlot', modo: 'claro', tipo: 'clasico',
    c: { fondo: '#F0EEE9', superficie: '#FAF9F6', texto: '#2A1A1C', texto2: '#6E5E60', acento: '#6E1E2B', acentoTxt: '#F0EEE9', acento2: '#C59A93' } },
  mandarina: { nombre: 'Mandarina de Verano', nota: 'Island Citrus, color de boda 2026', modo: 'claro', tipo: 'moderno',
    c: { fondo: '#FFF6EC', superficie: '#FFFFFF', texto: '#2B1A10', texto2: '#735A4A', acento: '#E85E0E', acentoTxt: '#2B1A10', acento2: '#F2B33D' } },
  porcelana: { nombre: 'Porcelana y Granate', nota: 'Azul francés con granate', modo: 'claro', tipo: 'clasico',
    c: { fondo: '#F5F3EE', superficie: '#FFFFFF', texto: '#17213A', texto2: '#525B70', acento: '#3D5A99', acentoTxt: '#F5F3EE', acento2: '#7A1F2B' } },
  higo: { nombre: 'Higo y Olivo', nota: 'Ciruela y oliva, en alza en Pinterest 2026', modo: 'claro', tipo: 'clasico',
    c: { fondo: '#F3EFE7', superficie: '#FBF9F4', texto: '#2A1730', texto2: '#625566', acento: '#5B2245', acentoTxt: '#F3EFE7', acento2: '#666E3D' } },
  matcha: { nombre: 'Matcha y Pétalo', nota: 'Verde matcha con rosa pétalo', modo: 'claro', tipo: 'moderno',
    c: { fondo: '#F8F2EF', superficie: '#FFFFFF', texto: '#1E2A1D', texto2: '#58614F', acento: '#4F6B3A', acentoTxt: '#F8F2EF', acento2: '#E8B4B8' } },
  buganvilla: { nombre: 'Buganvilla', nota: 'Magenta y cobalto, maximalismo con propósito', modo: 'claro', tipo: 'moderno',
    c: { fondo: '#FFF7F3', superficie: '#FFFFFF', texto: '#1B1133', texto2: '#5C506D', acento: '#B0186F', acentoTxt: '#FFF7F3', acento2: '#2445C9' } },
  etiqueta: { nombre: 'Etiqueta', nota: 'Blanco y negro, black tie', modo: 'claro', tipo: 'clasico',
    c: { fondo: '#F7F7F6', superficie: '#FFFFFF', texto: '#111214', texto2: '#5B5D63', acento: '#111214', acentoTxt: '#F7F7F6', acento2: '#D9D9D6' } },
};
const TEMA_DEFECTO = 'medianoche';

// --- utilidades de color (contraste WCAG y mezcla) ---
const _rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const _hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const _lum = (h) => { const c = _rgb(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contraste = (a, b) => { const x = _lum(a), y = _lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mezclar = (a, b, t) => { const p = _rgb(a), q = _rgb(b); return _hex(p.map((v, i) => v + (q[i] - v) * t)); };
// Acerca el color al "hacia" hasta que tenga el contraste pedido sobre el fondo
function legible(color, fondo, hacia, minimo = 4.5) {
  let c = color;
  for (let t = 0.1; contraste(c, fondo) < minimo && t <= 1; t += 0.1) c = mezclar(color, hacia, t);
  return c;
}

function aplicarTema(id, raiz = document.documentElement) {
  const t = TEMAS[id] || TEMAS[TEMA_DEFECTO];
  const v = { fondo: '--c-fondo', superficie: '--c-superficie', texto: '--c-texto', texto2: '--c-texto-2', acento: '--c-acento', acentoTxt: '--c-acento-txt', acento2: '--c-acento-2' };
  for (const [k, prop] of Object.entries(v)) raiz.style.setProperty(prop, t.c[k]);
  // Acento para textos pequeños (enlaces, puntos): se corrige si no llega a 4.5:1 sobre el fondo
  raiz.style.setProperty('--c-acento-texto', legible(t.c.acento, t.c.fondo, t.c.texto));
  raiz.dataset.modo = t.modo;
  raiz.dataset.tipo = t.tipo;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
  meta.content = t.c.fondo;
  return t;
}

// Acento para la pantalla (siempre oscura): el más legible entre acento y acento 2, aclarado si hace falta
function acentoPantalla(t, fondo = '#0E0E10') {
  const mejor = contraste(t.c.acento, fondo) >= 4.5 ? t.c.acento
    : [t.c.acento, t.c.acento2].sort((a, b) => contraste(b, fondo) - contraste(a, fondo))[0];
  const color = legible(mejor, fondo, '#F2F0EC', 4.5);
  return { color, texto: contraste('#111214', color) >= contraste('#F2F0EC', color) ? '#111214' : '#F2F0EC' };
}

// Monograma tipográfico de los novios: "Camila & Joaquín" -> "C & J"
function monograma(nombres) {
  const partes = String(nombres || '').split(/\s*(?:&|\by\b)\s*/i).map((s) => s.trim()).filter(Boolean);
  return partes.length >= 2 ? `${partes[0][0]} & ${partes[1][0]}`.toUpperCase() : (partes[0]?.[0] || '').toUpperCase();
}
