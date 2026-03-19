// habit-tracker/app/authStore.js
import { signal } from 'nano';
import { auth }   from './supabase.js';

export const authStatus  = signal('loading');
export const currentUser = signal(null);

export async function initAuth() {
  const wasRedirect = await auth.handleRedirect();
  const user = await auth.getUser();

  if (user) {
    currentUser.set(user);
    authStatus.set('logged_in');
  } else {
    currentUser.set(null);
    authStatus.set('logged_out');
  }
}

export async function login(provider) {
  await auth.loginWith(provider);
}

export async function logout() {
  // Limpiar localStorage de la app al cerrar sesión
  localStorage.removeItem('ht:habitos');
  localStorage.removeItem('ht:log');
  await auth.logout();
  currentUser.set(null);
  authStatus.set('logged_out');
}
