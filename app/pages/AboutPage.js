// nano/app/pages/AboutPage.js
import { defineComponent, html, onVisible } from '../../../nano/nano.min.js';

const features = [
  { icon: '🧩', title: 'Componentes',    desc: 'Funciones puras con html`` tagged templates' },
  { icon: '⚡', title: 'Señales',        desc: 'Estado atómico reactivo sin magia oculta' },
  { icon: '🌲', title: 'Virtual DOM',    desc: 'Diffing O(n) con soporte de keys' },
  { icon: '🛣️', title: 'Router',         desc: 'History API nativa, params dinámicos' },
  { icon: '🔄', title: 'Ciclo de vida',  desc: 'onMount, onVisible, onResize con observers' },
  { icon: '📦', title: 'Cero deps',      desc: 'Sin bundler. Solo ES Modules nativos.' },
];

export const AboutPage = defineComponent('AboutPage', () => {
  const el = html`
    <section class="about-page">
      <h1>Nano</h1>
      <p class="about-lead">
        Un micro-framework reactivo construido con Vanilla JS puro.
        Sin dependencias. Sin magia. Solo la plataforma web.
      </p>
      <div class="feature-grid">
        ${features.map(f => html`
          <div class="feature-card" data-key="${f.title}">
            <span class="feature-icon">${f.icon}</span>
            <h3>${f.title}</h3>
            <p>${f.desc}</p>
          </div>
        `)}
      </div>
      <div class="about-footer">
        <code>~200 líneas de código · ES2022 · sin build step</code>
      </div>
    </section>
  `;

  // Animación on-scroll para cada card
  el.querySelectorAll('.feature-card').forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    onVisible(card, () => {
      setTimeout(() => {
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, i * 80);
    }, { threshold: 0.1 });
  });

  return el;
});
