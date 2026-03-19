// nano/app/pages/HabitosPage.js
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

// ── Render de un ítem ──────────────────────────────────────────────────────────

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
          <button class="link-btn" data-goto="/habitos/gestionar">Crear uno →</button>
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
        <span class="log-titulo">${habito?.titulo ?? '(hábito eliminado)'}</span>
        <span class="log-check">✓</span>
      </li>
    `;
    ul.appendChild(li);
  });
  return ul;
}

// ── Animación FLIP para mover al final ────────────────────────────────────────
// Captura posiciones antes y después del cambio de orden y las interpola.

/**
 * @param {HTMLUListElement} ulEl
 * @param {number} habitoId
 * @param {() => void} commitFn - función que aplica el cambio de orden
 */
function flipMoverAlFinal(ulEl, habitoId, commitFn) {
  // 1. Snapshot de posiciones ANTES
  const antes = new Map();
  ulEl.querySelectorAll('li[data-key]').forEach(li => {
    antes.set(li.dataset.key, li.getBoundingClientRect().top);
  });

  // 2. Aplicar cambio en el store (reactive re-render via diff ocurrirá luego)
  commitFn();

  // El re-render es síncrono via subscriber. Leemos DESPUÉS con rAF.
  requestAnimationFrame(() => {
    ulEl.querySelectorAll('li[data-key]').forEach(li => {
      const key     = li.dataset.key;
      const topAntes = antes.get(key);
      if (topAntes === undefined) return;

      const topDespues = li.getBoundingClientRect().top;
      const delta      = topAntes - topDespues;

      if (Math.abs(delta) < 1) return; // no se movió

      // Aplicar transformación inversa y animar a 0
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

  let habitos  = habitosDelDia();
  let log      = logDelDia();
  let listaEl  = renderLista(habitos);
  let logEl    = renderLog(log, habitosStore.get().habitos);

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
          <button class="btn-historial" data-goto="/habitos/historial">Historial</button>
          <button class="btn-gestionar" data-goto="/habitos/gestionar">Gestionar →</button>
        </div>
      </header>

      <div class="progreso-wrap">
        <div class="progreso-texto">
          <span id="prog-count">${completados()} / ${total()}</span>
          <span>completados</span>
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

  el.querySelector('.lista-wrap').appendChild(listaEl);
  el.querySelector('.log-wrap').appendChild(logEl);

  onMount(el, () => {
    // Click en checkear → FLIP animación luego mover al final
    const cleanCheck = onEvent(el.querySelector('.lista-wrap'), 'click', e => {
      const btn = /** @type {HTMLElement} */(e.target).closest('button[data-id]');
      if (!btn || btn.hasAttribute('disabled')) return;

      const id  = Number(btn.getAttribute('data-id'));
      const ul  = el.querySelector('.habitos-list');

      if (ul) {
        flipMoverAlFinal(/** @type {HTMLUListElement} */(ul), id, () => {
          checkearHabito(id);
          moverAlFinal(id);
        });
      } else {
        checkearHabito(id);
        moverAlFinal(id);
      }
    });

    // Navegación interna
    const cleanNav = onEvent(el, 'click', e => {
      const btn = /** @type {HTMLElement} */(e.target).closest('[data-goto]');
      if (!btn) return;
      navigate(btn.getAttribute('data-goto'));
    });

    // Reactividad: re-render granular
    const unsub = habitosStore.subscribe(() => {
      const newHabitos = habitosDelDia();
      const newLog     = logDelDia();
      const allHabitos = habitosStore.get().habitos;

      const newLista = renderLista(newHabitos);
      // diff manual: reemplazar nodo si la lista cambió
      listaEl.replaceWith(newLista);
      listaEl = newLista;

      const newLogEl = renderLog(newLog, allHabitos);
      logEl.replaceWith(newLogEl);
      logEl = newLogEl;

      const c = newLog.filter(r => newHabitos.some(h => h.id === r.habito_id)).length;
      const t = newHabitos.length;
      el.querySelector('#prog-count').textContent = `${c} / ${t}`;
      el.querySelector('#prog-bar').style.width = `${t ? Math.round(c/t*100) : 0}%`;
    });

    return () => { cleanCheck(); cleanNav(); unsub(); };
  });

  return el;
});
