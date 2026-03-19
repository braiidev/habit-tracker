// habit-tracker/app/habitosStore.js
// ─────────────────────────────────────────────
// Estrategia de datos:
//   - Al login: fetch DB → guarda en localStorage → app lee localStorage
//   - Leer datos: siempre desde localStorage (0 requests)
//   - Crear/editar hábito: fetch DB → actualiza localStorage
//   - Checkear hábito: fetch DB directo → actualiza localStorage
// ─────────────────────────────────────────────
import { createStore } from 'nano';
import { db, auth }    from './supabase.js';

// ── Claves localStorage ───────────────────────────────────────────────────
const LS_HABITOS = 'ht:habitos';
const LS_LOG     = 'ht:log';

// ── Store reactivo (en memoria) ───────────────────────────────────────────
export const habitosStore = createStore({
  habitos:  _leerLS(LS_HABITOS, []),
  log:      _leerLS(LS_LOG, []),
  cargando: false,
  error:    null,
});

// Sincronizar localStorage cada vez que cambia el store
habitosStore.subscribe(({ habitos, log }) => {
  _guardarLS(LS_HABITOS, habitos);
  _guardarLS(LS_LOG, log);
});

// ── Helpers localStorage ───────────────────────────────────────────────────
function _leerLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function _guardarLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Helpers de fecha ───────────────────────────────────────────────────────
function userId() { return auth.currentUser()?.id; }

function inicioDiaTs(fecha = new Date()) {
  const d = new Date(fecha); d.setHours(0, 0, 0, 0); return d.getTime();
}
function finDiaTs(fecha = new Date()) {
  const d = new Date(fecha); d.setHours(23, 59, 59, 999); return d.getTime();
}
function inicioDiaISO() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
}

// ── Carga inicial (solo al login) ─────────────────────────────────────────

/**
 * Descarga hábitos y log de hoy desde Supabase.
 * Guarda en localStorage. Llamar una sola vez al iniciar sesión.
 */
export async function cargarTodo() {
  if (!userId()) return;
  habitosStore.set(s => ({ ...s, cargando: true, error: null }));
  try {
    const [habitos, log] = await Promise.all([
      db('habitos').select('*', {}, 'orden.asc,creado_en.asc'),
      db('registro_habitos').select('*', { fecha: `gte.${inicioDiaISO()}` }, 'fecha.desc'),
    ]);
    habitosStore.set(s => ({ ...s, habitos, log, cargando: false }));
  } catch (err) {
    habitosStore.set(s => ({ ...s, cargando: false, error: err.message }));
    console.error('[habitosStore] cargarTodo:', err);
  }
}

/**
 * Carga el log completo (todos los días) para el historial.
 * Solo se llama al abrir la página de historial.
 */
export async function cargarLogCompleto() {
  if (!userId()) return;
  try {
    const log = await db('registro_habitos').select('*', {}, 'fecha.desc');
    habitosStore.set(s => ({ ...s, log }));
  } catch (err) {
    console.error('[habitosStore] cargarLogCompleto:', err);
  }
}

// ── Acciones — tocan DB y luego actualizan localStorage ───────────────────

export async function crearHabito({ titulo, dias }) {
  const maxOrden = Math.max(0, ...habitosStore.get().habitos.map(h => h.orden));
  const [row] = await db('habitos').insert({
    user_id: userId(),
    titulo:  titulo.trim(),
    dias,
    orden:   maxOrden + 1,
    activo:  true,
  });
  habitosStore.set(s => ({ ...s, habitos: [...s.habitos, row] }));
}

export async function editarHabito(id, cambios) {
  const payload = {};
  if (cambios.titulo !== undefined) payload.titulo = cambios.titulo.trim();
  if (cambios.dias   !== undefined) payload.dias   = cambios.dias;
  await db('habitos').update(payload, { id: `eq.${id}` });
  habitosStore.set(s => ({
    ...s,
    habitos: s.habitos.map(h => h.id === id ? { ...h, ...payload } : h),
  }));
}

export async function desactivarHabito(id) {
  await db('habitos').update({ activo: false }, { id: `eq.${id}` });
  habitosStore.set(s => ({
    ...s,
    habitos: s.habitos.map(h => h.id === id ? { ...h, activo: false } : h),
  }));
}

export async function reactivarHabito(id) {
  await db('habitos').update({ activo: true }, { id: `eq.${id}` });
  habitosStore.set(s => ({
    ...s,
    habitos: s.habitos.map(h => h.id === id ? { ...h, activo: true } : h),
  }));
}

export async function swapHabitos(idA, idB) {
  const { habitos } = habitosStore.get();
  const hA = habitos.find(h => h.id === idA);
  const hB = habitos.find(h => h.id === idB);
  if (!hA || !hB) return;
  await Promise.all([
    db('habitos').update({ orden: hB.orden }, { id: `eq.${idA}` }),
    db('habitos').update({ orden: hA.orden }, { id: `eq.${idB}` }),
  ]);
  habitosStore.set(s => ({
    ...s,
    habitos: s.habitos.map(h => {
      if (h.id === idA) return { ...h, orden: hB.orden };
      if (h.id === idB) return { ...h, orden: hA.orden };
      return h;
    }),
  }));
}

export async function moverAlFinal(id) {
  const maxOrden = Math.max(0, ...habitosStore.get().habitos.map(h => h.orden));
  const nuevoOrden = maxOrden + 1;
  await db('habitos').update({ orden: nuevoOrden }, { id: `eq.${id}` });
  habitosStore.set(s => ({
    ...s,
    habitos: s.habitos.map(h => h.id === id ? { ...h, orden: nuevoOrden } : h),
  }));
}

/**
 * Checkear hábito — toca la DB directo (caso permitido).
 * Supabase asigna la fecha con DEFAULT now().
 */
export async function checkearHabito(habitoId) {
  if (yaCheckeadoHoy(habitoId)) return;
  const [row] = await db('registro_habitos').insert({
    user_id:   userId(),
    habito_id: habitoId,
  });
  // Agregar el registro al store local inmediatamente
  habitosStore.set(s => ({ ...s, log: [row, ...s.log] }));
}

// ── Queries — leen del store en memoria (0 requests) ──────────────────────

export function habitosDelDia(dia = new Date().getDay()) {
  return habitosStore.get().habitos
    .filter(h => h.activo && h.dias.includes(dia))
    .sort((a, b) => a.orden - b.orden);
}

/** Filtra el log por timestamps numéricos — timezone-safe */
export function logDelDia() {
  const inicio = inicioDiaTs();
  const fin    = finDiaTs();
  return habitosStore.get().log.filter(r => {
    const ts = new Date(r.fecha).getTime();
    return ts >= inicio && ts <= fin;
  });
}

export function yaCheckeadoHoy(habitoId) {
  return logDelDia().some(r => r.habito_id === habitoId);
}

export function todosLosHabitos() {
  return [...habitosStore.get().habitos].sort((a, b) => a.orden - b.orden);
}

export function nombreDia(dia) {
  return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dia];
}
