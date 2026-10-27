/* =========================================================
   app.js — Lo que hace funcionar la página
   (mapa, formulario, tarjetas y filtros)
   Para guardar/leer publicaciones usa el objeto "Datos"
   que está en datos.js.
   ========================================================= */

// ---------- Configuración ----------
const CENTRO = [-33.487, -70.545];   // Peñalolén
const ZOOM_INICIAL = 13;
const FOTO_TAMANO_MAX = 800;          // píxeles del lado más largo
const FOTO_CALIDAD = 0.7;             // 0 a 1 (más bajo = más liviana)

const TIPOS = { perro: 'Perro', gato: 'Gato', otro: 'Otro' };
const COLORES = { perdida: '#dc2626', encontrada: '#16a34a', resuelta: '#9ca3af' };

// ---------- Elementos de la página ----------
const $ = id => document.getElementById(id);
const modal = $('modal');
const formulario = $('formulario');
const lista = $('lista');
const filtroEstado = $('filtroEstado');
const filtroTipo = $('filtroTipo');

// Acá guardamos las publicaciones cargadas
let mascotas = [];

// =========================================================
// MAPA PRINCIPAL
// =========================================================
function crearMapa(idElemento) {
  const mapa = L.map(idElemento).setView(CENTRO, ZOOM_INICIAL);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    crossOrigin: true, // permite guardar el mapa para verlo sin internet
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapa);
  return mapa;
}

const mapa = crearMapa('mapa');
const capaPines = L.layerGroup().addTo(mapa);

// Pin de color hecho con un dibujo (SVG)
function crearPin(color) {
  return L.divIcon({
    className: 'pin',
    html: `<svg viewBox="0 0 24 36" width="30" height="45">
             <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
                   fill="${color}" stroke="#fff" stroke-width="2"/>
             <circle cx="12" cy="12" r="4.5" fill="#fff"/>
           </svg>`,
    iconSize: [30, 45],
    iconAnchor: [15, 45],   // la punta del pin
    popupAnchor: [0, -40]
  });
}
const PINES = {
  perdida: crearPin(COLORES.perdida),
  encontrada: crearPin(COLORES.encontrada),
  resuelta: crearPin(COLORES.resuelta)
};

// =========================================================
// MINI MAPA DEL FORMULARIO
// =========================================================
let mapaForm = null;      // se crea la primera vez que se abre el formulario
let pinForm = null;
let ubicacionElegida = null;

function prepararMapaForm() {
  if (!mapaForm) {
    mapaForm = crearMapa('mapaForm');
    mapaForm.on('click', e => {
      ubicacionElegida = e.latlng;
      const pin = PINES[$('estado').value];
      if (pinForm) pinForm.setLatLng(e.latlng).setIcon(pin);
      else pinForm = L.marker(e.latlng, { icon: pin }).addTo(mapaForm);
    });
    // Si cambian "perdida/encontrada", el pin cambia de color
    $('estado').addEventListener('change', () => {
      if (pinForm) pinForm.setIcon(PINES[$('estado').value]);
    });
  }
  // Leaflet necesita recalcular su tamaño cuando aparece dentro de un modal
  setTimeout(() => mapaForm.invalidateSize(), 50);
}

// =========================================================
// ABRIR / CERRAR FORMULARIO
// =========================================================
function abrirModal() {
  modal.classList.remove('oculto');
  document.body.classList.add('modal-abierto');
  prepararMapaForm();
}

function cerrarModal() {
  modal.classList.add('oculto');
  document.body.classList.remove('modal-abierto');
  formulario.reset();
  ubicacionElegida = null;
  if (pinForm) { pinForm.remove(); pinForm = null; }
}

$('btnPublicar').addEventListener('click', abrirModal);
$('btnCancelar').addEventListener('click', cerrarModal);
// Tocar fuera del formulario o apretar Esc también lo cierra
modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modal.classList.contains('oculto')) cerrarModal();
});

// =========================================================
// PUBLICAR
// =========================================================
formulario.addEventListener('submit', async e => {
  e.preventDefault(); // evita que la página se recargue

  if (!ubicacionElegida) {
    alert('Toca el mini mapa para marcar dónde se perdió o se encontró.');
    return;
  }
  const whatsapp = normalizarWhatsapp($('whatsapp').value);
  if (!whatsapp) {
    alert('Revisa el número de WhatsApp (ej: 912345678).');
    return;
  }

  const boton = formulario.querySelector('button[type="submit"]');
  boton.disabled = true;
  boton.textContent = 'Publicando...';

  try {
    const archivo = $('foto').files[0];
    const foto = archivo ? await comprimirFoto(archivo) : null;

    await Datos.crear({
      estado: $('estado').value,
      tipo: $('tipo').value,
      nombre: $('nombre').value.trim(),
      descripcion: $('descripcion').value.trim(),
      foto,
      whatsapp,
      lat: ubicacionElegida.lat,
      lng: ubicacionElegida.lng
    });

    cerrarModal();
    await cargarYMostrar();
  } catch (error) {
    alert(error.message || 'No se pudo publicar. Intenta de nuevo.');
  } finally {
    boton.disabled = false;
    boton.textContent = 'Publicar';
  }
});

// Achica la foto y la convierte en texto (base64) para poder guardarla
function comprimirFoto(archivo) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      const escala = Math.min(1, FOTO_TAMANO_MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', FOTO_CALIDAD));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la foto. Prueba con otra imagen.'));
    };
    img.src = url;
  });
}

// Deja el número listo para WhatsApp: solo dígitos y con 56 (Chile) adelante
function normalizarWhatsapp(texto) {
  let n = texto.replace(/\D/g, '');          // quita espacios, +, guiones
  if (n.startsWith('56') && n.length >= 11) return n;  // ya trae +56
  if (n.startsWith('0')) n = n.slice(1);
  if (n.length === 8) n = '9' + n;           // faltó el 9 del celular
  if (n.length !== 9) return null;
  return '56' + n;
}

// =========================================================
// MOSTRAR: PINES + TARJETAS (respetando los filtros)
// =========================================================
function pasaFiltros(m) {
  const estado = filtroEstado.value;
  const tipo = filtroTipo.value;
  // "Perdidas" y "Encontradas" muestran solo las activas;
  // "Todas" incluye también las que ya volvieron a casa.
  if (estado !== 'todas' && (m.estado !== estado || m.resuelta)) return false;
  if (tipo !== 'todos' && m.tipo !== tipo) return false;
  return true;
}

function mostrar() {
  // Activas primero, las resueltas al final
  const visibles = mascotas
    .filter(pasaFiltros)
    .sort((a, b) => a.resuelta - b.resuelta);

  // Pines
  capaPines.clearLayers();
  visibles.forEach(m => {
    const pin = PINES[m.resuelta ? 'resuelta' : m.estado];
    L.marker([m.lat, m.lng], { icon: pin })
      .bindPopup(`<strong>${escapar(m.nombre || TIPOS[m.tipo])}</strong><br>
                  ${textoEstado(m)}<br>
                  <a href="#tarjeta-${m.id}">Ver publicación</a>`)
      .addTo(capaPines);
  });

  // Tarjetas
  lista.innerHTML = '';
  if (visibles.length === 0) {
    lista.innerHTML = '<p class="vacio">No hay publicaciones con estos filtros. 🐶🐱</p>';
    return;
  }
  visibles.forEach(m => lista.appendChild(crearTarjeta(m)));
}

function crearTarjeta(m) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta' + (m.resuelta ? ' resuelta' : '');
  tarjeta.id = 'tarjeta-' + m.id;

  const claseEstado = m.resuelta ? 'resuelta' : m.estado;
  const mensaje = encodeURIComponent(
    `Hola, te escribo por tu publicación en Patitas Perdidas: ${m.nombre || TIPOS[m.tipo]}`);

  tarjeta.innerHTML = `
    ${m.foto
      ? `<img src="${m.foto}" alt="Foto de ${escapar(m.nombre || TIPOS[m.tipo])}" class="tarjeta-foto">`
      : `<div class="tarjeta-foto sin-foto">🐾</div>`}
    <div class="tarjeta-cuerpo">
      <span class="etiqueta ${claseEstado}">${textoEstado(m)}</span>
      <h3>${escapar(m.nombre || 'Sin nombre')}</h3>
      <p class="tarjeta-datos">${TIPOS[m.tipo] || 'Otro'} · ${formatearFecha(m.fecha)}</p>
      <p>${escapar(m.descripcion)}</p>
      <div class="tarjeta-botones">
        <a class="btn-whatsapp" target="_blank" rel="noopener"
           href="https://wa.me/${m.whatsapp}?text=${mensaje}">Contactar por WhatsApp</a>
        <button type="button" class="btn-secundario btn-mapa">📍 Ver en el mapa</button>
        ${m.resuelta ? '' : '<button type="button" class="btn-volvio">¡Ya volvió a casa!</button>'}
      </div>
    </div>`;

  tarjeta.querySelector('.btn-mapa').addEventListener('click', () => {
    mapa.setView([m.lat, m.lng], 16);
    $('mapa').scrollIntoView({ behavior: 'smooth' });
  });

  const btnVolvio = tarjeta.querySelector('.btn-volvio');
  if (btnVolvio) {
    btnVolvio.addEventListener('click', async () => {
      if (!confirm('¿Confirmas que esta mascota ya volvió a casa? 🎉')) return;
      await Datos.marcarResuelta(m.id);
      await cargarYMostrar();
    });
  }
  return tarjeta;
}

// ---------- Ayudantes ----------
function textoEstado(m) {
  if (m.resuelta) return '🏠 Volvió a casa';
  return m.estado === 'perdida' ? 'Perdida' : 'Encontrada';
}

function formatearFecha(iso) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// Evita que alguien meta código raro en los textos (importante con Supabase)
function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

async function cargarYMostrar() {
  mascotas = await Datos.listar();
  mostrar();
}

filtroEstado.addEventListener('change', mostrar);
filtroTipo.addEventListener('change', mostrar);

// ---------- Inicio ----------
cargarYMostrar();

// Registrar el service worker (permite instalar y abrir sin internet)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .catch(err => console.warn('Service worker no registrado:', err));
  });
}
