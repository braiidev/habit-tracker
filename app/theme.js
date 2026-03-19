// nano/app/theme.js
// ─────────────────────────────────────────────
// Toggle dark / light theme con persistencia
// ─────────────────────────────────────────────
import { signal }  from 'nano';
import { storage } from 'nano';

const KEY = 'nano:tema';

// Inicializa desde localStorage o preferencia del sistema
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const inicial     = storage.get(KEY, prefersDark ? 'dark' : 'light');

export const tema = signal(inicial);

// Aplica el tema al <html> y persiste
function aplicar(valor) {
  document.documentElement.setAttribute('data-theme', valor);
  storage.set(KEY, valor);
}

// Aplicar en carga
aplicar(inicial);

// Cada vez que cambia el signal
tema.subscribe(aplicar);

/** Alterna entre dark y light */
export function toggleTema() {
  tema.set(t => t === 'dark' ? 'light' : 'dark');
}
