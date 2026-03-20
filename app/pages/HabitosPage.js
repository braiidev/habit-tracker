// habit-tracker/app/pages/HabitosPage.js
import { defineComponent, html }   from 'nano';
import { onMount, onEvent }        from 'nano';
import { navigate }                from 'nano';
import {
  habitosStore,
  habitosDelDia,
  logDelDia,
  yaCheckeadoHoy,
  checkearHabito,
  moverAlFinal,
  nombreDia,
} from '../habitosStore.js';

const DIAS_COMPLETO = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DIAS_CORTO    = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

// ── Cálculos semanales (0 requests — usa el store local) ───────────────────────

/**
 * Retorna el timestamp del inicio del día N días atrás.
 * @param {number} diasAtras
 */
function inicioDiaOffset(diasAtras = 0) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Retorna el timestamp del fin del día N días atrás.
 */
function finDiaOffset(diasAtras = 0) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Para un día específico (offset desde hoy), calcula cuántos hábitos
 * correspondían ese día y cuántos fueron chequeados.
 * @param {number} diasAtras - 0=hoy, 1=ayer, etc.
 * @returns {{ total: number, completados: number, diaSem: number, fecha: Date }}
 */
function statsDia(diasAtras) {
  const fecha  = new Date();
  fecha.setDate(fecha.getDate() - diasAtras);
  fecha.setHours(12, 0, 0, 0); // mediodía para evitar DST edge cases
  const diaSem = fecha.getDay();

  const { habitos, log } = habitosStore.get();

  // Hábitos activos que correspondían ese día
  // (incluyendo desactivados que existían ese día — simplificamos a activos)
  const habitosDia = habitos.filter(h => h.dias.includes(diaSem));
  const total      = habitosDia.length;

  if (total === 0) return { total: 0, completados: 0, diaSem, fecha };

  // Registros de ese día
  const inicio = inicioDiaOffset(diasAtras);
  const fin    = finDiaOffset(diasAtras);
  const logDia = log.filter(r => {
    const ts = new Date(r.fecha).getTime();
    return ts >= inicio && ts <= fin;
  });

  // Cuántos hábitos del día fueron chequeados
  const completados = habitosDia.filter(h =>
    logDia.some(r => r.habito_id === h.id)
  ).length;

  return { total, completados, diaSem, fecha };
}

/**
 * Calcula los totales de la semana actual (lun–hoy) y la semana pasada.
 * @returns {{ actual: {completados:number, total:number}, pasada: {completados:number, total:number} }}
 */
function statsSemanales() {
  // Semana actual: últimos 7 días incluyendo hoy
  let actualComp = 0, actualTotal = 0;
  for (let i = 0; i < 7; i++) {
    const s = statsDia(i);
    actualComp  += s.completados;
    actualTotal += s.total;
  }

  // Semana pasada: días 7–13 hacia atrás
  let pasadaComp = 0, pasadaTotal = 0;
  for (let i = 7; i < 14; i++) {
    const s = statsDia(i);
    pasadaComp  += s.completados;
    pasadaTotal += s.total;
  }

  return {
    actual: { completados: actualComp, total: actualTotal },
    pasada: { completados: pasadaComp, total: pasadaTotal },
  };
}

// ── Render del resumen semanal ─────────────────────────────────────────────────

function renderResumenSemanal() {
  const { actual, pasada } = statsSemanales();

  // Porcentaje de completado de cada semana
  const pctActual = actual.total  ? Math.round(actual.completados  / actual.total  * 100) : 0;
  const pctPasada = pasada.total  ? Math.round(pasada.completados  / pasada.total  * 100) : 0;
  const diff      = pctActual - pctPasada;
  const tendencia = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : '=';
  const tendClass = diff > 0 ? 'tend-up' : diff < 0 ? 'tend-down' : 'tend-eq';

  // Mini-barras: últimos 7 días (hoy a la derecha)
  const barras = [];
  for (let i = 6; i >= 0; i--) {
    barras.push(statsDia(i));
  }
  const maxTotal = Math.max(1, ...barras.map(b => b.total));

  const barrasHTML = barras.map((b, idx) => {
    const esHoy     = idx === 6;
    const altura    = b.total > 0 ? Math.round((b.completados / b.total) * 100) : 0;
    const completo  = b.total > 0 && b.completados === b.total;
    const vacio     = b.total === 0;
    const label     = DIAS_CORTO[b.diaSem];

    return `
      <div class="barra-col">
        <div class="barra-track">
          <div class="barra-fill ${completo ? 'completa' : ''} ${vacio ? 'vacio' : ''} ${esHoy ? 'hoy' : ''}"
               style="height: ${vacio ? 0 : Math.max(4, altura)}%"
               title="${b.completados}/${b.total} ${label}"></div>
        </div>
        <span class="barra-label ${esHoy ? 'hoy' : ''}">${label}</span>
      </div>
    `;
  }).join('');

  const wrap = document.createElement('div');
  wrap.className = 'resumen-semanal';
  wrap.innerHTML = `
    <div class="resumen-header">
      <span class="resumen-titulo">Esta semana</span>
      <span class="resumen-tend ${tendClass}">${tendencia} vs semana pasada</span>
    </div>
    <div class="resumen-body">
      <div class="resumen-stats">
        <div class="resumen-num">
          <span class="resumen-big">${actual.completados}</span>
          <span class="resumen-de">/ ${actual.total}</span>
        </div>
        <div class="resumen-pct-wrap">
          <div class="resumen-pct-track">
            <div class="resumen-pct-fill" style="width:${pctActual}%"></div>
          </div>
          <span class="resumen-pct-label">${pctActual}%</span>
        </div>
        <div class="resumen-comp-label">completados</div>
      </div>
      <div class="resumen-barras">${barrasHTML}</div>
    </div>
  `;
  return wrap;
}

// ── Render ítems de la lista ───────────────────────────────────────────────────

function renderHabitoItem(habito) {
  const chequeado = yaCheckeadoHoy(habito.id);
  const el = html`
    <li class="habito-item ${chequeado ? 'chequeado' : ''}" data-key="${habito.id}">
      <button
        class="habito-check ${chequeado ? 'done' : ''}"
        data-id="${habito.id}"
        ${chequeado ? 'disabled' : ''}
        title="${chequeado ? 'Ya completado hoy' : 'Marcar como hecho'}"
      >${chequeado ? '✓' : '○'}</button>
      <div class="habito-info">
        <span class="habito-titulo">${habito.titulo}</span>
        <span class="habito-dias">
          ${[0,1,2,3,4,5,6].map(d =>
            `<span class="dia-chip ${habito.dias.includes(d) ? 'activo' : ''}">${nombreDia(d)}</span>`
          ).join('')}
        </span>
      </div>
    </li>
  `;
  return el;
}

function renderLista(habitos) {
  if (habitos.length === 0) {
    return html`
      <ul class="habitos-list">
        <li class="habito-empty">
          <span>Sin hábitos para hoy</span>
          <button class="link-btn" data-goto="/gestionar">Crear uno →</button>
        </li>
      </ul>
    `;
  }
  const ul = document.createElement('ul');
  ul.className = 'habitos-list';
  habitos.forEach(h => ul.appendChild(renderHabitoItem(h)));
  return ul;
}

function renderLog(log, habitos) {
  if (log.length === 0) {
    return html`<ul class="log-list"><li class="log-empty">Ningún hábito registrado hoy todavía.</li></ul>`;
  }
  const ul = document.createElement('ul');
  ul.className = 'log-list';
  [...log].reverse().forEach(r => {
    const habito = habitos.find(h => h.id === r.habito_id);
    const hora   = new Date(r.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const li = html`
      <li class="log-item" data-key="${r.id}">
        <span class="log-hora">${hora}</span>
        <span class="log-titulo">${habito?.titulo ?? '—'}</span>
        <span class="log-check">✓</span>
      </li>
    `;
    ul.appendChild(li);
  });
  return ul;
}

// ── Animación FLIP ─────────────────────────────────────────────────────────────

function flipMoverAlFinal(ulEl, habitoId, commitFn) {
  const antes = new Map();
  ulEl.querySelectorAll('li[data-key]').forEach(li => {
    antes.set(li.dataset.key, li.getBoundingClientRect().top);
  });

  commitFn();

  requestAnimationFrame(() => {
    ulEl.querySelectorAll('li[data-key]').forEach(li => {
      const key      = li.dataset.key;
      const topAntes = antes.get(key);
      if (topAntes === undefined) return;
      const delta = topAntes - li.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) return;
      li.style.transition = 'none';
      li.style.transform  = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        li.style.transition = 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)';
        li.style.transform  = 'translateY(0)';
        li.addEventListener('transitionend', () => {
          li.style.transition = '';
          li.style.transform  = '';
        }, { once: true });
      });
    });
  });
}

// ── Componente ─────────────────────────────────────────────────────────────────

export const HabitosPage = defineComponent('HabitosPage', () => {
  const hoy    = new Date().getDay();
  const diaStr = DIAS_COMPLETO[hoy];

  let habitos    = habitosDelDia();
  let log        = logDelDia();
  let listaEl    = renderLista(habitos);
  let logEl      = renderLog(log, habitosStore.get().habitos);
  let resumenEl  = renderResumenSemanal();

  const completados = () => logDelDia().filter(r =>
    habitosDelDia().some(h => h.id === r.habito_id)
  ).length;
  const total = () => habitosDelDia().length;

  const el = html`
    <section class="habitos-page">
      <header class="habitos-header">
        <div>
          <p class="habitos-fecha">${diaStr} ${new Date().toLocaleDateString('es-AR')}</p>
          <h1>Hábitos de hoy</h1>
        </div>
        <div class="habitos-header-actions">
          <button class="btn-historial" data-goto="/stats">Stats</button>
          <button class="btn-historial" data-goto="/historial">Historial</button>
          <button class="btn-gestionar" data-goto="/gestionar">Gestionar →</button>
        </div>
      </header>

      <div class="resumen-wrap"></div>

      <div class="progreso-wrap">
        <div class="progreso-texto">
          <span id="prog-count">${completados()} / ${total()}</span>
          <span>completados hoy</span>
        </div>
        <div class="progreso-bar-track">
          <div class="progreso-bar-fill" id="prog-bar"
            style="width: ${total() ? Math.round(completados()/total()*100) : 0}%">
          </div>
        </div>
      </div>

      <div class="lista-wrap"></div>

      <h2 class="section-title">Registro de hoy</h2>
      <div class="log-wrap"></div>
    </section>
  `;

  el.querySelector('.resumen-wrap').appendChild(resumenEl);
  el.querySelector('.lista-wrap').appendChild(listaEl);
  el.querySelector('.log-wrap').appendChild(logEl);

  onMount(el, () => {
    const cleanCheck = onEvent(el.querySelector('.lista-wrap'), 'click', e => {
      const btn = /** @type {HTMLElement} */(e.target).closest('button[data-id]');
      if (!btn || btn.hasAttribute('disabled')) return;

      const uuid = String(btn.getAttribute('data-id'));
      const ul   = el.querySelector('.habitos-list');

      if (ul) {
        flipMoverAlFinal(/** @type {HTMLUListElement} */(ul), uuid, () => {
          checkearHabito(uuid);
          moverAlFinal(uuid);
        });
      } else {
        checkearHabito(uuid);
        moverAlFinal(uuid);
      }
    });

    const cleanNav = onEvent(el, 'click', e => {
      const btn = /** @type {HTMLElement} */(e.target).closest('[data-goto]');
      if (!btn) return;
      navigate(btn.getAttribute('data-goto'));
    });

    const unsub = habitosStore.subscribe(() => {
      const newHabitos = habitosDelDia();
      const newLog     = logDelDia();
      const allHabitos = habitosStore.get().habitos;

      // Actualizar lista
      const newLista = renderLista(newHabitos);
      listaEl.replaceWith(newLista);
      listaEl = newLista;

      // Actualizar log
      const newLogEl = renderLog(newLog, allHabitos);
      logEl.replaceWith(newLogEl);
      logEl = newLogEl;

      // Actualizar resumen semanal
      const newResumen = renderResumenSemanal();
      resumenEl.replaceWith(newResumen);
      resumenEl = newResumen;

      // Actualizar barra de progreso diaria
      const c = newLog.filter(r => newHabitos.some(h => h.id === r.habito_id)).length;
      const t = newHabitos.length;
      el.querySelector('#prog-count').textContent = `${c} / ${t}`;
      el.querySelector('#prog-bar').style.width = `${t ? Math.round(c/t*100) : 0}%`;
    });

    return () => { cleanCheck(); cleanNav(); unsub(); };
  });

  return el;
});
