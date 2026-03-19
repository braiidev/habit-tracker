// habit-tracker/app/seo.js
// Actualiza <title>, meta description y canonical
// en cada navegación — Google indexa cada ruta con sus propios metadatos.

const BASE = 'https://braiidev.github.io/habit-tracker';

const META = {
  '/': {
    title: 'Habit Tracker — Seguimiento de hábitos diarios gratis',
    desc:  'Registrá y medí tus hábitos diarios. Estadísticas, rachas, heatmap de actividad y resumen semanal. Gratis, sin anuncios, sincronizado entre dispositivos.',
  },
  '/stats': {
    title: 'Estadísticas de hábitos — Rachas y progreso · Habit Tracker',
    desc:  'Visualizá tu progreso: racha actual, mejor racha histórica, tasa de completado por hábito y heatmap de actividad de los últimos 91 días.',
  },
  '/historial': {
    title: 'Historial de hábitos — Calendario mensual · Habit Tracker',
    desc:  'Revisá tu historial de hábitos en un calendario mensual. Navegá mes a mes y ve qué días completaste cada hábito.',
  },
  '/gestionar': {
    title: 'Gestionar hábitos — Crear y editar · Habit Tracker',
    desc:  'Creá, editá y organizá tus hábitos. Elegí los días de la semana para cada uno y reordenalos según tu preferencia.',
  },
};

function setMeta(attr, key, val) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', val);
}

export function updateSEO(path) {
  const m = META[path] ?? META['/'];

  // Título
  document.title = m.title;

  // Meta básicos
  setMeta('name',     'description',       m.desc);
  setMeta('name',     'twitter:title',     m.title);
  setMeta('name',     'twitter:description', m.desc);

  // Open Graph
  setMeta('property', 'og:title',       m.title);
  setMeta('property', 'og:description', m.desc);
  setMeta('property', 'og:url',         `${BASE}${path === '/' ? '' : path}`);

  // Canonical
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', `${BASE}${path === '/' ? '/' : path}`);
}
