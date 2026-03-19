// habit-tracker/app/components/NavBar.js
import { defineComponent, html, onMount, onEvent } from 'nano';
import { tema, toggleTema } from '../theme.js';
import { currentUser, logout } from '../authStore.js';
import { navigate } from 'nano';

export const NavBar = defineComponent('NavBar', () => {
  const icono = tema.get() === 'dark' ? '☀️' : '🌙';
  const user  = currentUser.get();

  const el = html`
    <nav class="navbar">
      <span class="nano-logo" id="logo">habit</span>
      <ul class="nav-links">
        <li><a href="/"          data-link>Hábitos</a></li>
        <li><a href="/historial" data-link>Historial</a></li>
        <li><a href="/gestionar" data-link>Gestionar</a></li>
        <li>
          <button class="btn-tema" id="btn-tema" title="Cambiar tema">${icono}</button>
        </li>
        <li>
          <button class="btn-user" id="btn-logout" title="Cerrar sesión">
            ${user?.user_metadata?.avatar_url
              ? `<img src="${user.user_metadata.avatar_url}" class="user-avatar" alt="avatar">`
              : `<span class="user-initials">${(user?.email?.[0] ?? '?').toUpperCase()}</span>`
            }
          </button>
        </li>
      </ul>
    </nav>
  `;

  onMount(el, () => {
    const btn = el.querySelector('#btn-tema');
    const u1  = tema.subscribe(t => { btn.textContent = t === 'dark' ? '☀️' : '🌙'; });
    const c1  = onEvent(btn, 'click', () => toggleTema());
    const c2  = onEvent(el.querySelector('#logo'), 'click', () => navigate('/'));
    const c3  = onEvent(el.querySelector('#btn-logout'), 'click', async () => {
      if (confirm('¿Cerrar sesión?')) await logout();
    });
    return () => { u1(); c1(); c2(); c3(); };
  });

  return el;
});
