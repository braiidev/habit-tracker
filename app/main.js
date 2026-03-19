// habit-tracker/app/main.js
import './theme.js';
import { mount, Router, html, defineComponent } from 'nano';
import { authStatus, currentUser, initAuth, logout } from './authStore.js';
import { cargarTodo } from './habitosStore.js';
import { NavBar }        from './components/NavBar.js';
import { LoginPage }     from './pages/LoginPage.js';
import { HabitosPage }   from './pages/HabitosPage.js';
import { GestionarPage } from './pages/GestionarPage.js';
import { HistorialPage } from './pages/HistorialPage.js';

// ── Pantalla de carga ──────────────────────────────────────────────────────
const LoadingPage = defineComponent('LoadingPage', () => html`
  <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;flex-direction:column;gap:16px">
    <div class="nano-logo" style="font-size:32px;font-family:var(--mono)">habit</div>
    <div style="color:var(--muted);font-size:13px">cargando...</div>
  </div>
`);

// ── Router y navegación ────────────────────────────────────────────────────
let router;

function arrancarApp() {
  mount(NavBar, '#nav');

  router = new Router([
    { path: '/',                  component: HabitosPage,   title: 'Habit Tracker' },
    { path: '/habitos',           component: HabitosPage,   title: 'Habit Tracker' },
    { path: '/habitos/gestionar', component: GestionarPage, title: 'Gestionar hábitos' },
    { path: '/habitos/historial', component: HistorialPage, title: 'Historial' },
  ], { outlet: '#root', basePath: 'auto' });
}

// ── Inicialización ────────────────────────────────────────────────────────
mount(LoadingPage, '#root');

// Suscribir al estado de auth para re-renderizar según cambie
authStatus.subscribe(async status => {
  if (status === 'loading') return;

  if (status === 'logged_out') {
    // Mostrar login, sin navbar
    document.querySelector('#nav').innerHTML = '';
    mount(LoginPage, '#root');
    return;
  }

  if (status === 'logged_in') {
    // Cargar datos y arrancar la app
    await cargarTodo();
    arrancarApp();
  }
});

// Arrancar detección de sesión
await initAuth();
