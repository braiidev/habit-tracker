// habit-tracker/app/habitosStore.js
import { createStore } from 'nano';
import { db, auth }    from './supabase.js';

/**
 * @typedef {Object} Habito
 * @property {string}   id
 * @property {string}   user_id
 * @property {string}   titulo
 * @property {number[]} dias
 * @property {number}   orden
 * @property {boolean}  activo
 * @property {string}   creado_en
 */

/**
 * @typedef {Object} RegistroHabito
 * @property {string} id
 * @property {string} user_id
 * @property {string} habito_id
 * @property {string} fecha
 */

export const habitosStore = createStore({
  habitos:  [],
  log:      [],
  cargando: false,
  error:    null,
});

function userId() { return auth.currentUser()?.id; }

function inicioDia(fecha = new Date()) {
  const d = new Date(fecha); d.setHours(0,0,0,0); return d.toISOString();
}
function finDia(fecha = new Date()) {
  const d = new Date(fecha); d.setHours(23,59,59,999); return d.toISOString();
}

// ── Carga ──────────────────────────────────────────────────────────────────

export async function cargarTodo() {
  if (!userId()) return;
  habitosStore.set(s => ({ ...s, cargando: true, error: null }));
  try {
    const [habitos, log] = await Promise.all([
      db('habitos').select('*', {}, 'orden.asc,creado_en.asc'),
      db('registro_habitos').select('*', { 'fecha': `gte.${inicioDia()}` }, 'fecha.desc'),
    ]);
    habitosStore.set(s => ({ ...s, habitos, log, cargando: false }));
  } catch (err) {
    habitosStore.set(s => ({ ...s, cargando: false, error: err.message }));
  }
}

export async function cargarLogCompleto() {
  if (!userId()) return;
  try {
    const log = await db('registro_habitos').select('*', {}, 'fecha.desc');
    habitosStore.set(s => ({ ...s, log }));
  } catch (err) {
    console.error('[habitosStore] cargarLogCompleto:', err);
  }
}

// ── Acciones ───────────────────────────────────────────────────────────────

export async function crearHabito({ titulo, dias }) {
  const maxOrden = Math.max(0, ...habitosStore.get().habitos.map(h => h.orden));
  const [row] = await db('habitos').insert({
    user_id: userId(), titulo: titulo.trim(), dias,
    orden: maxOrden + 1, activo: true, creado_en: new Date().toISOString(),
  });
  habitosStore.set(s => ({ ...s, habitos: [...s.habitos, row] }));
}

export async function editarHabito(id, cambios) {
  const payload = {};
  if (cambios.titulo !== undefined) payload.titulo = cambios.titulo.trim();
  if (cambios.dias   !== undefined) payload.dias   = cambios.dias;
  await db('habitos').update(payload, { id: `eq.${id}` });
  habitosStore.set(s => ({
    ...s, habitos: s.habitos.map(h => h.id === id ? { ...h, ...payload } : h),
  }));
}

export async function desactivarHabito(id) {
  await db('habitos').update({ activo: false }, { id: `eq.${id}` });
  habitosStore.set(s => ({
    ...s, habitos: s.habitos.map(h => h.id === id ? { ...h, activo: false } : h),
  }));
}

export async function reactivarHabito(id) {
  await db('habitos').update({ activo: true }, { id: `eq.${id}` });
  habitosStore.set(s => ({
    ...s, habitos: s.habitos.map(h => h.id === id ? { ...h, activo: true } : h),
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
    ...s, habitos: s.habitos.map(h => h.id === id ? { ...h, orden: nuevoOrden } : h),
  }));
}

export async function checkearHabito(habitoId) {
  if (yaCheckeadoHoy(habitoId)) return;
  const [row] = await db('registro_habitos').insert({
    user_id: userId(), habito_id: habitoId, fecha: new Date().toISOString(),
  });
  habitosStore.set(s => ({ ...s, log: [row, ...s.log] }));
}

// ── Queries ────────────────────────────────────────────────────────────────

export function habitosDelDia(dia = new Date().getDay()) {
  return habitosStore.get().habitos
    .filter(h => h.activo && h.dias.includes(dia))
    .sort((a, b) => a.orden - b.orden);
}

export function logDelDia() {
  const hoy    = inicioDia();
  const manana = finDia();
  return habitosStore.get().log.filter(r => r.fecha >= hoy && r.fecha <= manana);
}

export function yaCheckeadoHoy(habitoId) {
  return logDelDia().some(r => r.habito_id === habitoId);
}

export function todosLosHabitos() {
  return [...habitosStore.get().habitos].sort((a, b) => a.orden - b.orden);
}

export function nombreDia(dia) {
  return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][dia];
}
