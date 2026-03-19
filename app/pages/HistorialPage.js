// nano/app/pages/HistorialPage.js
// Vista de historial: calendario mensual clásico
import { defineComponent, html }           from 'nano';
import { onMount, onEvent }                from 'nano';
import { navigate }                        from 'nano';
import { signal }                          from 'nano';
import { habitosStore }                    from '../habitosStore.js';

// ── Constantes ─────────────────────────────────────────────────────────────────
const DIAS_SEMANA  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES        = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Inicio del día 00:00:00 para un timestamp o Date */
function inicioDia(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Genera todas las celdas (incluyendo blancos) de un mes para la grilla */
function celdasMes(year, month) {
  const primerDia   = new Date(year, month, 1);
  const ultimoDia   = new Date(year, month + 1, 0);
  const offsetInicio = primerDia.getDay(); // 0=Dom
  const celdas = [];

  // Blancos al inicio
  for (let i = 0; i < offsetInicio; i++) celdas.push(null);

  // Días del mes
  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    celdas.push(new Date(year, month, d));
  }

  // Blancos al final para completar la última semana
  while (celdas.length % 7 !== 0) celdas.push(null);

  return celdas;
}

/** Índice de checkeos por día: "inicioDia" → [habito, ...] */
function buildLogIndex() {
  const { habitos, log } = habitosStore.get();
  /** @type {Map<number, import('../habitosStore.js').Habito[]>} */
  const idx = new Map();

  log.forEach(r => {
    const key     = inicioDia(r.fecha);
    const habito  = habitos.find(h => h.id === r.habito_id);
    if (!habito) return;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(habito);
  });

  return idx;
}

/** Colores para hasta 8 hábitos distintos (por índice de creación) */
const COLORES = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ec4899',
  '#8b5cf6', '#14b8a6', '#f97316', '#6366f1',
];

function colorHabito(habito, todos) {
  const idx = todos.findIndex(h => h.id === habito.id);
  return COLORES[idx % COLORES.length];
}

// ── Stats ──────────────────────────────────────────────────────────────────────

function calcularRacha(logIdx, hoy) {
  let racha  = 0;
  let cursor = hoy;
  while (logIdx.has(cursor)) {
    racha++;
    cursor -= 86400000;
  }
  return racha;
}

// ── Popover ────────────────────────────────────────────────────────────────────

let popoverActual = null;

function cerrarPopover() {
  popoverActual?.remove();
  popoverActual = null;
}

/**
 * @param {HTMLElement} celda
 * @param {Date} fecha
 * @param {import('../habitosStore.js').Habito[]} habitosDia
 * @param {import('../habitosStore.js').Habito[]} todos
 */
function mostrarPopover(celda, fecha, habitosDia, todos) {
  cerrarPopover();

  const fechaStr = fecha.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const pop = document.createElement('div');
  pop.className = 'cal-popover';

  const filas = habitosDia.map(h => {
    const color = colorHabito(h, todos);
    return `<li class="pop-habito">
      <span class="pop-dot" style="background:${color}"></span>
      <span>${h.titulo}</span>
    </li>`;
  }).join('');

  pop.innerHTML = `
    <div class="pop-fecha">${fechaStr}</div>
    <ul class="pop-lista">${filas}</ul>
  `;

  // Posicionar relativo al contenedor de la celda
  document.body.appendChild(pop);

  const cRect = celda.getBoundingClientRect();
  const pRect = pop.getBoundingClientRect();
  const scroll = window.scrollY;

  let top  = cRect.bottom + scroll + 6;
  let left = cRect.left + cRect.width / 2 - pRect.width / 2;

  // No salir por la derecha
  if (left + pRect.width > window.innerWidth - 12)
    left = window.innerWidth - pRect.width - 12;
  if (left < 8) left = 8;

  // Si no cabe abajo, mostrarlo arriba
  if (cRect.bottom + pRect.height + 12 > window.innerHeight)
    top = cRect.top + scroll - pRect.height - 6;

  pop.style.top  = `${top}px`;
  pop.style.left = `${left}px`;

  popoverActual = pop;
}

// ── Render del calendario ──────────────────────────────────────────────────────

/**
 * @param {{ year: number, month: number, logIdx: Map, todos: import('../habitosStore.js').Habito[], primerHabito: number, hoy: number }} opts
 */
function renderCalendario({ year, month, logIdx, todos, primerHabito, hoy }) {
  const celdas       = celdasMes(year, month);
  const inicioMes    = new Date(year, month, 1).getTime();
  const finMes       = new Date(year, month + 1, 0, 23, 59, 59).getTime();
  const hayDatos     = primerHabito <= finMes;

  const wrap = document.createElement('div');
  wrap.className = 'cal-grid';

  // Cabecera días de la semana
  DIAS_SEMANA.forEach(d => {
    const th = document.createElement('div');
    th.className = 'cal-th';
    th.textContent = d;
    wrap.appendChild(th);
  });

  // Celdas
  celdas.forEach(fecha => {
    const cell = document.createElement('div');

    if (!fecha) {
      cell.className = 'cal-cell cal-blank';
      wrap.appendChild(cell);
      return;
    }

    const ts           = inicioDia(fecha);
    const esHoy        = ts === hoy;
    const antesInicio  = ts < inicioDia(primerHabito);
    const esFuturo     = ts > hoy;
    const habitosDia   = logIdx.get(ts) ?? [];
    const tieneChecks  = habitosDia.length > 0;

    cell.className = [
      'cal-cell',
      esHoy       ? 'es-hoy'      : '',
      antesInicio ? 'antes-inicio': '',
      esFuturo    ? 'es-futuro'   : '',
      tieneChecks ? 'tiene-checks': '',
    ].filter(Boolean).join(' ');

    // Número del día
    const num = document.createElement('span');
    num.className = 'cal-num';
    num.textContent = fecha.getDate();
    cell.appendChild(num);

    // Puntos de hábitos chequeados
    if (tieneChecks && !antesInicio) {
      const dots = document.createElement('div');
      dots.className = 'cal-dots';
      // Máximo 4 puntos visibles + contador si hay más
      const visibles = habitosDia.slice(0, 4);
      visibles.forEach(h => {
        const dot = document.createElement('span');
        dot.className = 'cal-dot';
        dot.style.background = colorHabito(h, todos);
        dots.appendChild(dot);
      });
      if (habitosDia.length > 4) {
        const mas = document.createElement('span');
        mas.className = 'cal-dot-mas';
        mas.textContent = `+${habitosDia.length - 4}`;
        dots.appendChild(mas);
      }
      cell.appendChild(dots);

      // Click → popover
      cell.addEventListener('click', e => {
        e.stopPropagation();
        if (popoverActual) { cerrarPopover(); return; }
        mostrarPopover(cell, fecha, habitosDia, todos);
      });
    }

    wrap.appendChild(cell);
  });

  return wrap;
}

// ── Leyenda de hábitos ─────────────────────────────────────────────────────────

function renderLeyenda(todos) {
  const activos = todos.filter(h => h.activo);
  if (activos.length === 0) return document.createElement('div');

  const wrap = document.createElement('div');
  wrap.className = 'cal-leyenda';

  activos.forEach(h => {
    const item = document.createElement('span');
    item.className = 'ley-habito';
    item.innerHTML = `<span class="ley-dot-habito" style="background:${colorHabito(h, todos)}"></span>${h.titulo}`;
    wrap.appendChild(item);
  });

  return wrap;
}

// ── Componente ─────────────────────────────────────────────────────────────────

export const HistorialPage = defineComponent('HistorialPage', () => {
  const { habitos, log } = habitosStore.get();
  const hoy = inicioDia(Date.now());

  // Mes inicial = mes actual
  const mesActual = new Date();
  const mesSignal = signal({ year: mesActual.getFullYear(), month: mesActual.getMonth() });

  // Límites de navegación
  const primerHabito = habitos.length
    ? Math.min(...habitos.map(h => h.creadoEn))
    : Date.now();

  const mesMinimo = { year: new Date(primerHabito).getFullYear(), month: new Date(primerHabito).getMonth() };
  const mesMaximo = { year: mesActual.getFullYear(), month: mesActual.getMonth() };

  function puedeIrAtras({ year, month }) {
    return year > mesMinimo.year || (year === mesMinimo.year && month > mesMinimo.month);
  }
  function puedeIrAdelante({ year, month }) {
    return year < mesMaximo.year || (year === mesMaximo.year && month < mesMaximo.month);
  }

  // Stats globales
  const logIdx   = buildLogIndex();
  const racha    = calcularRacha(logIdx, hoy);
  const diasActivos = logIdx.size;
  const totalChecks = log.length;

  // DOM
  const el = html`
    <section class="historial-page">

      <header class="historial-header">
        <div>
          <button class="btn-back" id="btn-back">← Volver</button>
          <h1>Historial</h1>
        </div>
      </header>

      <div class="historial-stats">
        <div class="stat-card">
          <span class="stat-num">${totalChecks}</span>
          <span class="stat-label">checkeos totales</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">${diasActivos}</span>
          <span class="stat-label">días activos</span>
        </div>
        <div class="stat-card highlight">
          <span class="stat-num">${racha}</span>
          <span class="stat-label">días de racha</span>
        </div>
      </div>

      <div class="cal-container">

        <div class="cal-nav">
          <button class="cal-nav-btn" id="btn-prev">←</button>
          <span class="cal-titulo" id="cal-titulo"></span>
          <button class="cal-nav-btn" id="btn-next">→</button>
        </div>

        <div id="cal-wrap"></div>

        <div id="leyenda-wrap"></div>

      </div>

    </section>
  `;

  const calWrap     = el.querySelector('#cal-wrap');
  const leyendaWrap = el.querySelector('#leyenda-wrap');
  const calTitulo   = el.querySelector('#cal-titulo');
  const btnPrev     = el.querySelector('#btn-prev');
  const btnNext     = el.querySelector('#btn-next');

  function renderMes() {
    const { year, month } = mesSignal.get();
    const todos   = habitosStore.get().habitos;
    const logIdxN = buildLogIndex();

    // Título
    calTitulo.textContent = `${MESES[month]} ${year}`;

    // Botones nav
    btnPrev.disabled = !puedeIrAtras({ year, month });
    btnNext.disabled = !puedeIrAdelante({ year, month });

    // Calendario
    calWrap.innerHTML = '';
    calWrap.appendChild(renderCalendario({ year, month, logIdx: logIdxN, todos, primerHabito, hoy }));

    // Leyenda
    leyendaWrap.innerHTML = '';
    leyendaWrap.appendChild(renderLeyenda(todos));
  }

  onMount(el, () => {
    renderMes(); // render inicial

    const cleanBack = onEvent(el.querySelector('#btn-back'), 'click', () => navigate('/habitos'));

    const cleanPrev = onEvent(btnPrev, 'click', () => {
      const { year, month } = mesSignal.get();
      if (!puedeIrAtras({ year, month })) return;
      mesSignal.set(month === 0
        ? { year: year - 1, month: 11 }
        : { year, month: month - 1 });
      renderMes();
    });

    const cleanNext = onEvent(btnNext, 'click', () => {
      const { year, month } = mesSignal.get();
      if (!puedeIrAdelante({ year, month })) return;
      mesSignal.set(month === 11
        ? { year: year + 1, month: 0 }
        : { year, month: month + 1 });
      renderMes();
    });

    // Cerrar popover al hacer click fuera
    const cleanDoc = onEvent(document, 'click', () => cerrarPopover());

    return () => { cleanBack(); cleanPrev(); cleanNext(); cleanDoc(); cerrarPopover(); };
  });

  return el;
});
