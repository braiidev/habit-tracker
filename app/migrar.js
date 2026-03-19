// habit-tracker/app/migrar.js
// ─────────────────────────────────────────────
// Migración de datos desde localStorage a Supabase.
// Se ejecuta UNA SOLA VEZ en el primer login.
// Si no hay datos locales, no hace nada.
// ─────────────────────────────────────────────

import { db } from './supabase.js';

const LS_HABITOS  = 'nano:habitos';
const LS_LOG      = 'nano:log';
const LS_MIGRATED = 'nano:migrated';

/**
 * Detecta datos en localStorage y los sube a Supabase.
 * Después borra el localStorage para evitar duplicados.
 * @param {string} userId - UUID del usuario autenticado
 */
export async function migrarDesdeLocalStorage(userId) {
  // Ya se migró antes — no hacer nada
  if (localStorage.getItem(LS_MIGRATED)) return;

  const habitosRaw = localStorage.getItem(LS_HABITOS);
  const logRaw     = localStorage.getItem(LS_LOG);

  // No hay nada que migrar
  if (!habitosRaw && !logRaw) {
    localStorage.setItem(LS_MIGRATED, '1');
    return;
  }

  /** @type {Array} */
  const habitosLocal = habitosRaw ? JSON.parse(habitosRaw) : [];
  /** @type {Array} */
  const logLocal     = logRaw     ? JSON.parse(logRaw)     : [];

  if (habitosLocal.length === 0 && logLocal.length === 0) {
    localStorage.setItem(LS_MIGRATED, '1');
    return;
  }

  console.log(`[migrar] Encontrados ${habitosLocal.length} hábitos y ${logLocal.length} registros en localStorage`);

  // ── Mapa de IDs viejos (timestamp) → UUIDs nuevos ─────────────────────────
  const idMap = new Map(); // oldId (number) → newUUID (string)

  // ── Migrar hábitos ────────────────────────────────────────────────────────
  if (habitosLocal.length > 0) {
    const habitosParaInsertar = habitosLocal.map(h => ({
      user_id:   userId,
      titulo:    h.titulo,
      dias:      h.dias,
      orden:     h.orden,
      activo:    h.activo,
      creado_en: new Date(h.creadoEn).toISOString(),
    }));

    const insertados = await db('habitos').insert(habitosParaInsertar);

    // Mapear IDs viejos → UUIDs nuevos por posición
    // (los insertamos en el mismo orden que el array local)
    insertados.forEach((row, i) => {
      idMap.set(habitosLocal[i].id, row.id);
    });

    console.log(`[migrar] ${insertados.length} hábitos migrados`);
  }

  // ── Migrar log ────────────────────────────────────────────────────────────
  if (logLocal.length > 0) {
    const logParaInsertar = logLocal
      .filter(r => idMap.has(r.habitoId)) // solo registros con hábito válido
      .map(r => ({
        user_id:   userId,
        habito_id: idMap.get(r.habitoId),
        fecha:     new Date(r.fecha).toISOString(),
      }));

    if (logParaInsertar.length > 0) {
      await db('registro_habitos').insert(logParaInsertar);
      console.log(`[migrar] ${logParaInsertar.length} registros migrados`);
    }
  }

  // ── Limpiar localStorage ──────────────────────────────────────────────────
  localStorage.removeItem(LS_HABITOS);
  localStorage.removeItem(LS_LOG);
  localStorage.setItem(LS_MIGRATED, '1');

  console.log('[migrar] Completada. localStorage limpiado.');
}
