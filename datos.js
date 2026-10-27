/* =========================================================
   datos.js — Dónde se guardan las publicaciones
   ---------------------------------------------------------
   Todo el resto de la app usa SOLO estas tres funciones:
     Datos.listar()            -> devuelve todas las publicaciones
     Datos.crear(mascota)      -> guarda una nueva
     Datos.marcarResuelta(id)  -> marca "¡Ya volvió a casa!"

   Hoy guardan en localStorage (la memoria del navegador,
   cada persona ve solo lo suyo). Cuando pasemos a Supabase,
   solo cambiaremos el interior de estas funciones; app.js
   no se toca. Por eso todas son "async" (Supabase responde
   por internet y hay que esperarlo).

   Forma de cada publicación:
   {
     id:          "texto único",
     estado:      "perdida" | "encontrada",
     tipo:        "perro" | "gato" | "otro",
     nombre:      "Firulais" (puede ir vacío),
     descripcion: "texto",
     foto:        "data:image/jpeg;base64,..." o null,
     whatsapp:    "56912345678",
     lat:         -33.48, lng: -70.54,
     fecha:       "2026-10-27T15:30:00.000Z",
     resuelta:    false
   }
   ========================================================= */

const CLAVE_LOCALSTORAGE = 'patitas-perdidas';

function leerTodo() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_LOCALSTORAGE)) || [];
  } catch {
    return [];
  }
}

function guardarTodo(lista) {
  try {
    localStorage.setItem(CLAVE_LOCALSTORAGE, JSON.stringify(lista));
  } catch (error) {
    // localStorage tiene un límite (~5 MB). Las fotos ocupan bastante.
    throw new Error('No queda espacio en este teléfono para más publicaciones. ' +
      'Marca algunas como "¡Ya volvió a casa!" o borra datos del navegador.');
  }
}

function generarId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const Datos = {
  async listar() {
    // Las más nuevas primero
    return leerTodo().sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  async crear(mascota) {
    const nueva = {
      ...mascota,
      id: generarId(),
      fecha: new Date().toISOString(),
      resuelta: false
    };
    const lista = leerTodo();
    lista.push(nueva);
    guardarTodo(lista);
    return nueva;
  },

  async marcarResuelta(id) {
    const lista = leerTodo();
    const mascota = lista.find(m => m.id === id);
    if (mascota) {
      mascota.resuelta = true;
      guardarTodo(lista);
    }
  }
};
