// nano/app/pages/GestionarPage.js
import { defineComponent, html }  from 'nano';
import { onMount, onEvent }       from 'nano';
import { navigate }               from 'nano';
import {
  habitosStore,
  todosLosHabitos,
  crearHabito,
  editarHabito,
  desactivarHabito,
  reactivarHabito,
  swapHabitos,
  nombreDia,
} from '../habitosStore.js';

const DIAS = [0,1,2,3,4,5,6];

// ── Modal crear/editar ─────────────────────────────────────────────────────────

function renderModal({ habito = null, onClose }) {
  const esEdicion = habito !== null;
  const diasSel   = new Set(habito?.dias ?? []);

  const overlay = html`
    <div class="modal-overlay">
      <div class="modal">
        <h2>${esEdicion ? 'Editar hábito' : 'Nuevo hábito'}</h2>
        <label class="field-label">Título</label>
        <input id="m-titulo" class="field-input" type="text"
          placeholder="Ej: Meditar 10 minutos"
          value="${habito?.titulo ?? ''}" autocomplete="off">
        <label class="field-label">Días activos</label>
        <div class="dias-selector">
          ${DIAS.map(d => `
            <button class="dia-btn ${diasSel.has(d) ? 'sel' : ''}" data-dia="${d}" type="button">
              ${nombreDia(d)}
            </button>`).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" id="m-cancel">Cancelar</button>
          <button class="btn-save"   id="m-save">${esEdicion ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    </div>
  `;

  overlay.querySelectorAll('.dia-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = Number(btn.getAttribute('data-dia'));
      if (diasSel.has(d)) { diasSel.delete(d); btn.classList.remove('sel'); }
      else                { diasSel.add(d);    btn.classList.add('sel');    }
    });
  });

  overlay.querySelector('#m-cancel').addEventListener('click', onClose);
  overlay.querySelector('#m-save').addEventListener('click', () => {
    const titulo = /** @type {HTMLInputElement} */(overlay.querySelector('#m-titulo')).value.trim();
    if (!titulo) { overlay.querySelector('#m-titulo').classList.add('error'); return; }
    if (diasSel.size === 0) { alert('Seleccioná al menos un día'); return; }
    if (esEdicion) editarHabito(habito.id, { titulo, dias: [...diasSel] });
    else           crearHabito({ titulo, dias: [...diasSel] });
    onClose();
  });

  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') onClose(); });
  overlay.addEventListener('click',   e => { if (e.target === overlay) onClose(); });
  return overlay;
}

// ── Animación FLIP para swap ───────────────────────────────────────────────────

/**
 * Captura posiciones, ejecuta el swap y anima los nodos afectados.
 * @param {HTMLElement} container
 * @param {() => void} commitFn
 */
function flipSwap(container, commitFn) {
  // Snapshot ANTES
  const antes = new Map();
  container.querySelectorAll('[data-key]').forEach(el => {
    antes.set(el.dataset.key, el.getBoundingClientRect().top);
  });

  commitFn(); // store cambia → subscriber re-renderiza

  requestAnimationFrame(() => {
    container.querySelectorAll('[data-key]').forEach(el => {
      const key      = el.dataset.key;
      const topAntes = antes.get(key);
      if (topAntes === undefined) return;

      const delta = topAntes - el.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) return;

      el.style.transition = 'none';
      el.style.transform  = `translateY(${delta}px)`;

      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.transform  = 'translateY(0)';
        el.addEventListener('transitionend', () => {
          el.style.transition = '';
          el.style.transform  = '';
        }, { once: true });
      });
    });
  });
}

// ── Tabla de hábitos ───────────────────────────────────────────────────────────

function renderTabla({ onEditar, contenedor }) {
  const habitos = todosLosHabitos();

  if (habitos.length === 0) {
    const div = document.createElement('div');
    div.className = 'tabla-wrap';
    div.innerHTML = '<p class="tabla-empty">Todavía no tenés hábitos. ¡Creá el primero!</p>';
    return div;
  }

  // Separar activos e inactivos
  const activos   = habitos.filter(h => h.activo);
  const inactivos = habitos.filter(h => !h.activo);

  const wrap = document.createElement('div');
  wrap.className = 'tabla-wrap';

  // ── Sección activos ──
  if (activos.length > 0) {
    const secTitulo = document.createElement('p');
    secTitulo.className = 'tabla-seccion-titulo';
    secTitulo.textContent = 'Activos';
    wrap.appendChild(secTitulo);

    activos.forEach((h, idx) => {
      const esPrimero = idx === 0;
      const esUltimo  = idx === activos.length - 1;

      const row = html`
        <div class="habito-row" data-key="${h.id}">
          <div class="row-orden">
            <button class="btn-orden" data-swap-up="${h.id}"
              ${esPrimero ? 'disabled' : ''} title="Subir">↑</button>
            <button class="btn-orden" data-swap-down="${h.id}"
              ${esUltimo  ? 'disabled' : ''} title="Bajar">↓</button>
          </div>
          <div class="row-info">
            <span class="row-titulo">${h.titulo}</span>
            <span class="row-dias">
              ${DIAS.map(d =>
                `<span class="dia-chip ${h.dias.includes(d) ? 'activo' : ''}">${nombreDia(d)}</span>`
              ).join('')}
            </span>
          </div>
          <div class="row-actions">
            <button class="btn-edit"        data-id="${h.id}">Editar</button>
            <button class="btn-desactivar"  data-id="${h.id}">Desactivar</button>
          </div>
        </div>
      `;

      row.querySelector('.btn-edit').addEventListener('click', () => onEditar(h));
      row.querySelector('.btn-desactivar').addEventListener('click', () => desactivarHabito(h.id));

      // Botones ↑ ↓
      const btnUp = row.querySelector('[data-swap-up]');
      if (!esPrimero) {
        btnUp.addEventListener('click', () => {
          const prev = activos[idx - 1];
          flipSwap(contenedor(), () => swapHabitos(h.id, prev.id));
        });
      }

      const btnDown = row.querySelector('[data-swap-down]');
      if (!esUltimo) {
        btnDown.addEventListener('click', () => {
          const next = activos[idx + 1];
          flipSwap(contenedor(), () => swapHabitos(h.id, next.id));
        });
      }

      wrap.appendChild(row);
    });
  }

  // ── Sección inactivos ──
  if (inactivos.length > 0) {
    const secTitulo = document.createElement('p');
    secTitulo.className = 'tabla-seccion-titulo inactivos';
    secTitulo.textContent = 'Inactivos';
    wrap.appendChild(secTitulo);

    inactivos.forEach(h => {
      const row = html`
        <div class="habito-row inactivo" data-key="${h.id}">
          <div class="row-orden"><!-- sin reorder para inactivos --></div>
          <div class="row-info">
            <span class="row-titulo">${h.titulo}</span>
            <span class="row-dias">
              ${DIAS.map(d =>
                `<span class="dia-chip ${h.dias.includes(d) ? 'activo' : ''}">${nombreDia(d)}</span>`
              ).join('')}
            </span>
          </div>
          <div class="row-actions">
            <button class="btn-reactivar" data-id="${h.id}">Reactivar</button>
          </div>
        </div>
      `;
      row.querySelector('.btn-reactivar').addEventListener('click', () => reactivarHabito(h.id));
      wrap.appendChild(row);
    });
  }

  return wrap;
}

// ── Componente ─────────────────────────────────────────────────────────────────

export const GestionarPage = defineComponent('GestionarPage', () => {
  let modalEl  = null;
  let tablaEl  = null;

  // Referencia al contenedor de la tabla para el FLIP
  const getContenedor = () => el?.querySelector('.tabla-container');

  function closeModal() { modalEl?.remove(); modalEl = null; }

  function openModal(habito = null) {
    closeModal();
    modalEl = renderModal({ habito, onClose: closeModal });
    el.appendChild(modalEl);
    setTimeout(() => modalEl?.querySelector('#m-titulo')?.focus(), 50);
  }

  tablaEl = renderTabla({ onEditar: openModal, contenedor: getContenedor });

  const el = html`
    <section class="gestionar-page">
      <header class="gestionar-header">
        <div>
          <button class="btn-back" id="btn-back">← Volver</button>
          <h1>Gestionar hábitos</h1>
        </div>
        <button class="btn-nuevo" id="btn-nuevo">+ Nuevo hábito</button>
      </header>
      <div class="tabla-container"></div>
    </section>
  `;

  el.querySelector('.tabla-container').appendChild(tablaEl);

  onMount(el, () => {
    const cleanBack  = onEvent(el.querySelector('#btn-back'),  'click', () => navigate('/'));
    const cleanNuevo = onEvent(el.querySelector('#btn-nuevo'), 'click', () => openModal(null));

    const unsub = habitosStore.subscribe(() => {
      const newTabla = renderTabla({ onEditar: openModal, contenedor: getContenedor });
      tablaEl.replaceWith(newTabla);
      tablaEl = newTabla;
    });

    return () => { cleanBack(); cleanNuevo(); unsub(); };
  });

  return el;
});
