// habit-tracker/app/authStore.js
// ─────────────────────────────────────────────
// Estado reactivo de autenticación.
// Expone signals que los componentes pueden suscribir.
// ─────────────────────────────────────────────

import { signal }   from 'nano';
import { auth }     from './supabase.js';
import { migrarDesdeLocalStorage } from './migrar.js';

/**
 * @typedef {'loading'|'logged_out'|'logged_in'} AuthStatus
 */

/** @type {import('nano').Signal<AuthStatus>} */
export const authStatus = signal('loading');

/** @type {import('nano').Signal<Object|null>} */
export const currentUser = signal(null);

/**
 * Inicializa la autenticación al arrancar la app.
 * 1. Detecta si venimos de un redirect OAuth
 * 2. Si no, verifica si hay sesión guardada
 * 3. Notifica el estado via signals
 */
export async function initAuth() {
  // Paso 1: ¿venimos de un redirect OAuth?
  const wasRedirect = await auth.handleRedirect();

  // Paso 2: obtener usuario (de la sesión existente o del redirect)
  const user = await auth.getUser();

  if (user) {
    currentUser.set(user);
    authStatus.set('logged_in');

    // Paso 3: migrar datos de localStorage si los hay (solo primera vez)
    if (wasRedirect) {
      await migrarDesdeLocalStorage(user.id).catch(err =>
        console.warn('[auth] Migración omitida:', err)
      );
    }
  } else {
    currentUser.set(null);
    authStatus.set('logged_out');
  }
}

/**
 * Login con Google o GitHub.
 * Redirige al proveedor — la página se recarga al volver.
 * @param {'google'|'github'} provider
 */
export async function login(provider) {
  await auth.loginWith(provider);
}

/**
 * Cierra la sesión y limpia el estado.
 */
export async function logout() {
  await auth.logout();
  currentUser.set(null);
  authStatus.set('logged_out');
}
