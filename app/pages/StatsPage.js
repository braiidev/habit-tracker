// habit-tracker/app/pages/StatsPage.js
import { defineComponent, html, onMount, onEvent, onVisible } from 'nano';
import { navigate }      from 'nano';
import { habitosStore, cargarLogCompleto } from '../habitosStore.js';

// ── Helpers de fecha ───────────────────────────────────────────────────────────

function inicioDia(fecha = new Date()) {
  const d = new Date(fecha); d.setHours(0,0,0,0); return d.getTime();
}
function diasAtras(n) {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d.getTime();
}

// ── Motor de cálculo — todo desde localStorage ─────────────────────────────────

function calcular() {
  const { habitos, log } = habitosStore.get();
  const hoy = inicioDia();

  // Índice rápido: "habitoId:inicioDia" → true
  const logIdx = new Set(log.map(r => `${r.habito_id}:${inicioDia(r.fecha)}`));

  // ── Por hábito ────────────────────────────────────────────────────────────
  const statsHabito = habitos.map(h => {
    const creadoTs = inicioDia(h.creado_en);

    // Días desde creación hasta hoy donde el hábito correspondía
    let diasCorrespondian = 0;
    let diasCompletados   = 0;
    let rachaActual       = 0;
    let mejorRacha        = 0;
    let rachaTemp         = 0;
    let ultimoCheck       = null;

    // Recorrer desde hoy hacia atrás hasta la fecha de creación
    let cursor = hoy;
    const MS_DIA = 86400000;

    while (cursor >= creadoTs) {
      const diaSem = new Date(cursor).getDay();
      if (h.dias.includes(diaSem)) {
        diasCorrespondian++;
        const chequeado = logIdx.has(`${h.id}:${cursor}`);
        if (chequeado) {
          diasCompletados++;
          rachaTemp++;
          if (!ultimoCheck) ultimoCheck = cursor;
          if (rachaTemp > mejorRacha) mejorRacha = rachaTemp;
        } else {
          if (cursor < hoy) rachaTemp = 0; // no romper racha por hoy aún pendiente
        }
      }
      cursor -= MS_DIA;
    }

    // Racha actual: contar hacia atrás desde ayer (hoy puede no haber correspondido aún)
    rachaActual = 0;
    cursor = hoy;
    let rachaRota = false;
    while (cursor >= creadoTs && !rachaRota) {
      const diaSem = new Date(cursor).getDay();
      if (h.dias.includes(diaSem)) {
        if (logIdx.has(`${h.id}:${cursor}`)) {
          rachaActual++;
        } else if (cursor < hoy) {
          rachaRota = true;
        }
      }
      cursor -= MS_DIA;
    }

    const tasa = diasCorrespondian > 0
      ? Math.round(diasCompletados / diasCorrespondian * 100)
      : 0;

    return {
      habito: h,
      diasCompletados,
      diasCorrespondian,
      tasa,
      rachaActual,
      mejorRacha,
      ultimoCheck,
    };
  });

  // ── Globales ──────────────────────────────────────────────────────────────
  const totalChecks   = log.length;
  const diasConActividad = new Set(log.map(r => inicioDia(r.fecha))).size;

  // Racha global: días consecutivos con AL MENOS un check
  let rachaGlobal = 0;
  let cursorG = hoy;
  const diasConLog = new Set(log.map(r => inicioDia(r.fecha)));
  while (diasConLog.has(cursorG)) {
    rachaGlobal++;
    cursorG -= 86400000;
  }

  // Mejor racha global
  const diasOrdenados = [...diasConLog].sort((a,b) => a-b);
  let mejorGlobal = 0, tempG = 0, prevG = null;
  for (const ts of diasOrdenados) {
    if (prevG && ts - prevG === 86400000) { tempG++; }
    else { tempG = 1; }
    if (tempG > mejorGlobal) mejorGlobal = tempG;
    prevG = ts;
  }

  // Día de la semana más productivo
  const checksPorDia = [0,0,0,0,0,0,0];
  log.forEach(r => checksPorDia[new Date(r.fecha).getDay()]++);
  const mejorDia = checksPorDia.indexOf(Math.max(...checksPorDia));

  return { statsHabito, totalChecks, diasConActividad, rachaGlobal, mejorGlobal, mejorDia, checksPorDia };
}

// ── Heatmap 90 días ────────────────────────────────────────────────────────────

function renderHeatmap() {
  const { habitos, log } = habitosStore.get();
  const hoy    = inicioDia();
  const MS_DIA = 86400000;
  const DIAS   = 91; // 13 semanas

  // Intensidad por día: cuántos hábitos se completaron / cuántos correspondían
  const dias = [];
  for (let i = DIAS - 1; i >= 0; i--) {
    const ts     = hoy - i * MS_DIA;
    const diaSem = new Date(ts).getDay();
    const correspondian = habitos.filter(h => h.dias.includes(diaSem) && inicioDia(h.creado_en) <= ts).length;
    const completados   = correspondian > 0
      ? habitos.filter(h => h.dias.includes(diaSem) && inicioDia(h.creado_en) <= ts &&
          log.some(r => r.habito_id === h.id && inicioDia(r.fecha) === ts)).length
      : 0;
    const pct = correspondian > 0 ? completados / correspondian : -1; // -1 = sin hábitos ese día
    dias.push({ ts, pct, completados, correspondian });
  }

  // Agrupar en semanas (columnas)
  const semanas = [];
  for (let i = 0; i < dias.length; i += 7) {
    semanas.push(dias.slice(i, i + 7));
  }

  const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const DIAS_CORTO  = ['D','L','M','X','J','V','S'];

  // Etiquetas de mes: detectar cuándo cambia el mes
  const labelsMes = semanas.map(sem => {
    const primerDia = new Date(sem[0].ts);
    const ultimoDia = new Date(sem[sem.length-1].ts);
    if (primerDia.getDate() <= 7 || primerDia.getMonth() !== ultimoDia.getMonth()) {
      return MESES_CORTO[ultimoDia.getMonth()];
    }
    return '';
  });

  const wrap = document.createElement('div');
  wrap.className = 'heatmap-wrap';

  // Labels días semana (izquierda)
  const labelsCol = document.createElement('div');
  labelsCol.className = 'heatmap-dias-labels';
  [0,1,2,3,4,5,6].forEach(d => {
    const span = document.createElement('span');
    span.className = 'heatmap-dia-label';
    span.textContent = d % 2 === 1 ? DIAS_CORTO[d] : '';
    labelsCol.appendChild(span);
  });

  // Grid
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  // Labels de meses encima
  const mesRow = document.createElement('div');
  mesRow.className = 'heatmap-meses';
  labelsMes.forEach(label => {
    const span = document.createElement('span');
    span.className = 'heatmap-mes-label';
    span.textContent = label;
    mesRow.appendChild(span);
  });
  grid.appendChild(mesRow);

  // Celdas
  const celdasWrap = document.createElement('div');
  celdasWrap.className = 'heatmap-celdas';
  celdasWrap.appendChild(labelsCol);

  const cols = document.createElement('div');
  cols.className = 'heatmap-cols';

  semanas.forEach(semana => {
    const col = document.createElement('div');
    col.className = 'heatmap-col';
    semana.forEach(dia => {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      const esHoy = dia.ts === hoy;
      if (dia.pct < 0) {
        cell.classList.add('hc-vacio');
      } else if (dia.pct === 0) {
        cell.classList.add('hc-cero');
      } else if (dia.pct < 0.34) {
        cell.classList.add('hc-bajo');
      } else if (dia.pct < 0.67) {
        cell.classList.add('hc-medio');
      } else if (dia.pct < 1) {
        cell.classList.add('hc-alto');
      } else {
        cell.classList.add('hc-total');
      }
      if (esHoy) cell.classList.add('hc-hoy');

      const fecha = new Date(dia.ts).toLocaleDateString('es-AR', { day:'numeric', month:'short', year:'numeric' });
      cell.title = dia.pct >= 0
        ? `${fecha} — ${dia.completados}/${dia.correspondian}`
        : `${fecha} — sin hábitos`;
      col.appendChild(cell);
    });
    cols.appendChild(col);
  });

  celdasWrap.appendChild(cols);
  grid.appendChild(celdasWrap);
  wrap.appendChild(grid);

  // Leyenda
  const leyenda = document.createElement('div');
  leyenda.className = 'heatmap-leyenda';
  leyenda.innerHTML = `
    <span class="hm-ley-label">Menos</span>
    <div class="hm-ley-cell hc-cero"></div>
    <div class="hm-ley-cell hc-bajo"></div>
    <div class="hm-ley-cell hc-medio"></div>
    <div class="hm-ley-cell hc-alto"></div>
    <div class="hm-ley-cell hc-total"></div>
    <span class="hm-ley-label">Más</span>
  `;
  wrap.appendChild(leyenda);
  return wrap;
}

// ── Tarjetas por hábito ────────────────────────────────────────────────────────

function renderTarjetaHabito(stat) {
  const { habito, tasa, rachaActual, mejorRacha, diasCompletados, diasCorrespondian } = stat;

  // Mini sparkline: últimas 4 semanas día a día
  const { log } = habitosStore.get();
  const hoy    = inicioDia();
  const MS_DIA = 86400000;
  const PUNTOS = 28;
  const sparkData = [];
  for (let i = PUNTOS - 1; i >= 0; i--) {
    const ts     = hoy - i * MS_DIA;
    const diaSem = new Date(ts).getDay();
    if (habito.dias.includes(diaSem)) {
      const hecho = log.some(r => r.habito_id === habito.id && inicioDia(r.fecha) === ts);
      sparkData.push(hecho ? 1 : 0);
    } else {
      sparkData.push(null); // no aplica
    }
  }

  // SVG sparkline
  const W = 120, H = 28;
  const pts = sparkData.filter(v => v !== null);
  const gap = pts.length > 1 ? W / (pts.length - 1) : W;
  let ptIdx = 0;
  const coords = sparkData.map((v, i) => {
    if (v === null) return null;
    const x = ptIdx * gap;
    const y = v === 1 ? 4 : H - 4;
    ptIdx++;
    return { x, y, v };
  }).filter(Boolean);

  const pathD = coords.map((p, i) =>
    i === 0 ? `M${p.x.toFixed(1)},${p.y}` : `L${p.x.toFixed(1)},${p.y}`
  ).join(' ');

  const dots = coords.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y}" r="2.5" fill="${p.v ? 'var(--accent)' : 'var(--border)'}"/>`
  ).join('');

  const spark = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="overflow:visible">
      <path d="${pathD}" fill="none" stroke="var(--border)" stroke-width="1.5" stroke-linejoin="round"/>
      ${dots}
    </svg>
  `;

  const tasaColor = tasa >= 80 ? 'stat-tasa-alta' : tasa >= 50 ? 'stat-tasa-media' : 'stat-tasa-baja';

  const card = html`
    <div class="stat-habito-card">
      <div class="shc-header">
        <div class="shc-info">
          <span class="shc-titulo">${habito.titulo}</span>
          ${!habito.activo ? '<span class="shc-inactivo">inactivo</span>' : ''}
        </div>
        <span class="shc-tasa ${tasaColor}">${tasa}%</span>
      </div>

      <div class="shc-spark">${spark}</div>

      <div class="shc-stats">
        <div class="shc-stat">
          <span class="shc-stat-val">${rachaActual}</span>
          <span class="shc-stat-label">racha actual</span>
        </div>
        <div class="shc-stat">
          <span class="shc-stat-val">${mejorRacha}</span>
          <span class="shc-stat-label">mejor racha</span>
        </div>
        <div class="shc-stat">
          <span class="shc-stat-val">${diasCompletados}</span>
          <span class="shc-stat-label">días totales</span>
        </div>
      </div>

      <div class="shc-barra-wrap">
        <div class="shc-barra-fill" style="width:0%" data-target="${tasa}"></div>
      </div>
    </div>
  `;

  // Animar barra al entrar al viewport
  onVisible(card, () => {
    const fill = card.querySelector('.shc-barra-fill');
    setTimeout(() => { fill.style.width = tasa + '%'; }, 100);
  }, { threshold: 0.2 });

  return card;
}

// ── Componente ─────────────────────────────────────────────────────────────────

export const StatsPage = defineComponent('StatsPage', () => {
  const DIAS_NOMBRE = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

  // Cargar log completo al entrar (puede haber días anteriores sin cargar)
  cargarLogCompleto();

  const el = html`
    <section class="stats-page">
      <header class="stats-header">
        <div>
          <button class="btn-back" id="btn-back">← Volver</button>
          <h1>Estadísticas</h1>
        </div>
      </header>
      <div id="stats-content"></div>
    </section>
  `;

  function build() {
    const stats = calcular();
    const { totalChecks, diasConActividad, rachaGlobal, mejorGlobal, mejorDia, checksPorDia } = stats;

    const content = document.createElement('div');
    content.className = 'stats-content';

    // ── Cards globales ──────────────────────────────────────────────────────
    const globales = html`
      <div class="stats-globales">
        <div class="sg-card accent">
          <span class="sg-val">${rachaGlobal}</span>
          <span class="sg-label">racha actual</span>
          <span class="sg-sub">días consecutivos</span>
        </div>
        <div class="sg-card">
          <span class="sg-val">${mejorGlobal}</span>
          <span class="sg-label">mejor racha</span>
          <span class="sg-sub">histórica</span>
        </div>
        <div class="sg-card">
          <span class="sg-val">${totalChecks}</span>
          <span class="sg-label">checkeos</span>
          <span class="sg-sub">totales</span>
        </div>
        <div class="sg-card">
          <span class="sg-val">${diasConActividad}</span>
          <span class="sg-label">días activos</span>
          <span class="sg-sub">con al menos 1</span>
        </div>
      </div>
    `;
    content.appendChild(globales);

    // ── Barras por día de la semana ─────────────────────────────────────────
    const maxChecks = Math.max(1, ...checksPorDia);
    const diasNombres = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const barrasSection = document.createElement('div');
    barrasSection.className = 'stats-section';
    barrasSection.innerHTML = `<h2 class="stats-section-title">Actividad por día de la semana</h2>`;

    const barrasWrap = document.createElement('div');
    barrasWrap.className = 'dow-barras';
    checksPorDia.forEach((val, i) => {
      const pct    = Math.round(val / maxChecks * 100);
      const esMejor = i === mejorDia;
      const bar = html`
        <div class="dow-col">
          <span class="dow-val">${val}</span>
          <div class="dow-track">
            <div class="dow-fill ${esMejor ? 'mejor' : ''}" style="height:0%" data-target="${pct}"></div>
          </div>
          <span class="dow-label ${esMejor ? 'mejor' : ''}">${diasNombres[i]}</span>
        </div>
      `;
      onVisible(bar, () => {
        setTimeout(() => {
          bar.querySelector('.dow-fill').style.height = pct + '%';
        }, i * 40);
      }, { threshold: 0.1 });
      barrasWrap.appendChild(bar);
    });
    barrasSection.appendChild(barrasWrap);

    const mejorDiaLabel = html`
      <p class="dow-mejor-label">
        Tu día más productivo es el <strong>${DIAS_NOMBRE[mejorDia]}</strong>
        con ${checksPorDia[mejorDia]} checkeos históricos.
      </p>
    `;
    barrasSection.appendChild(mejorDiaLabel);
    content.appendChild(barrasSection);

    // ── Heatmap ─────────────────────────────────────────────────────────────
    const heatSection = document.createElement('div');
    heatSection.className = 'stats-section';
    heatSection.innerHTML = `<h2 class="stats-section-title">Actividad — últimos 91 días</h2>`;
    heatSection.appendChild(renderHeatmap());
    content.appendChild(heatSection);

    // ── Por hábito ──────────────────────────────────────────────────────────
    if (stats.statsHabito.length > 0) {
      const habitosSection = document.createElement('div');
      habitosSection.className = 'stats-section';
      habitosSection.innerHTML = `<h2 class="stats-section-title">Por hábito</h2>`;

      const grid = document.createElement('div');
      grid.className = 'stats-habitos-grid';

      // Ordenar por tasa descendente
      [...stats.statsHabito]
        .sort((a, b) => b.tasa - a.tasa)
        .forEach(stat => grid.appendChild(renderTarjetaHabito(stat)));

      habitosSection.appendChild(grid);
      content.appendChild(habitosSection);
    }

    return content;
  }

  el.querySelector('#stats-content').appendChild(build());

  onMount(el, () => {
    const cleanBack = onEvent(el.querySelector('#btn-back'), 'click', () => navigate('/'));

    // Re-build si el store cambia (ej: se checkea un hábito en otra pestaña)
    const unsub = habitosStore.subscribe(() => {
      const content = el.querySelector('#stats-content');
      content.innerHTML = '';
      content.appendChild(build());
    });

    return () => { cleanBack(); unsub(); };
  });

  return el;
});
