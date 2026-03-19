// habit-tracker/app/main.js
import './theme.js';
import { mount, Router, html, defineComponent } from 'nano';
import { authStatus, initAuth }                 from './authStore.js';
import { cargarTodo }                           from './habitosStore.js';
import { NavBar }                               from './components/NavBar.js';
import { LoginPage }                            from './pages/LoginPage.js';
import { HabitosPage }                          from './pages/HabitosPage.js';
import { GestionarPage }                        from './pages/GestionarPage.js';
import { HistorialPage }                        from './pages/HistorialPage.js';

// Pantalla de carga mínima mientras se verifica la sesión
const LoadingPage = defineComponent('LoadingPage', () => html`
  <div style="display:flex;align-items:center;justify-content:center;min-height:80vh;flex-direction:column;gap:12px">
    <div style="font-size:36px;color:var(--accent);font-family:Georgia,serif">h</div>
    <div style="font-size:13px;color:var(--muted)">cargando...</div>
  </div>
`);

mount(LoadingPage, '#root');

authStatus.subscribe(async status => {
  if (status === 'loading') return;

  if (status === 'logged_out') {
    document.querySelector('#nav').innerHTML = '';
    mount(LoginPage, '#root');
    return;
  }

  if (status === 'logged_in') {
    // Carga inicial desde DB → queda en localStorage para el resto de la sesión
    await cargarTodo();

    mount(NavBar, '#nav');

    new Router([
      { path: '/',          component: HabitosPage,   title: 'Hábitos de hoy' },
      { path: '/gestionar', component: GestionarPage, title: 'Gestionar hábitos' },
      { path: '/historial', component: HistorialPage, title: 'Historial' },
    ], { outlet: '#root', basePath: 'auto' });
  }
});

// Arrancar — detecta sesión existente o redirect OAuth
await initAuth();
