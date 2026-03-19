// habit-tracker/app/main.js
import './theme.js';
import { mount, Router, html, defineComponent } from 'nano';
import { authStatus, initAuth }                 from './authStore.js';
import { cargarTodo }                           from './habitosStore.js';
import { updateSEO }                            from './seo.js';
import { NavBar }                               from './components/NavBar.js';
import { LoginPage }                            from './pages/LoginPage.js';
import { HabitosPage }                          from './pages/HabitosPage.js';
import { GestionarPage }                        from './pages/GestionarPage.js';
import { HistorialPage }                        from './pages/HistorialPage.js';
import { StatsPage }                            from './pages/StatsPage.js';

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
    await cargarTodo();
    mount(NavBar, '#nav');

    const router = new Router([
      { path: '/',          component: HabitosPage,   title: 'Habit Tracker' },
      { path: '/stats',     component: StatsPage,     title: 'Estadísticas' },
      { path: '/historial', component: HistorialPage, title: 'Historial' },
      { path: '/gestionar', component: GestionarPage, title: 'Gestionar' },
    ], { outlet: '#root', basePath: 'auto' });

    // SEO dinámico en cada navegación
    updateSEO(router.cleanPath());
    router.onNavigate(path => updateSEO(path));
  }
});

await initAuth();
