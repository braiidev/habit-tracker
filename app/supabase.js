// habit-tracker/app/supabase.js
// ─────────────────────────────────────────────
// Cliente liviano de Supabase usando fetch puro.
// Sin SDK oficial (evitamos 200KB de dependencia).
// Cubre: Auth (OAuth, sesión) + REST API (CRUD).
// ─────────────────────────────────────────────

const URL  = 'https://pnkfurfokxmmwfalknnh.supabase.co';
const KEY  = 'sb_publishable_ITR0YdKZI9v7Hs187qh2dA_LV6wPLGr';
const STORAGE_KEY = 'nano:sb:session';

// ── Sesión en memoria + localStorage ──────────────────────────────────────────

let _session = null;

function _loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) _session = JSON.parse(raw);
  } catch { _session = null; }
}

function _saveSession(session) {
  _session = session;
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else         localStorage.removeItem(STORAGE_KEY);
}

_loadSession();

// ── Headers comunes ───────────────────────────────────────────────────────────

function _headers(extra = {}) {
  const h = {
    'apikey':       KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
  if (_session?.access_token) {
    h['Authorization'] = `Bearer ${_session.access_token}`;
  }
  return h;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  /**
   * Inicia el flujo OAuth con Google o GitHub.
   * El browser redirige a Supabase → proveedor → de vuelta a la app.
   * @param {'google'|'github'} provider
   */
  async loginWith(provider) {
    const redirectTo = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href =
      `${URL}/auth/v1/authorize?provider=${provider}&redirect_to=${redirectTo}`;
  },

  /**
   * Después del redirect OAuth, Supabase agrega el token al hash de la URL.
   * Esta función lo detecta, lo intercambia por una sesión y la guarda.
   * Llamar una sola vez al inicio de la app.
   * @returns {Promise<boolean>} true si se estableció una sesión nueva
   */
  async handleRedirect() {
    const hash   = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    const code   = new URLSearchParams(window.location.search).get('code');

    // Flujo PKCE — Supabase envía un `code` en la query string
    if (code) {
      const res = await fetch(`${URL}/auth/v1/token?grant_type=pkce`, {
        method: 'POST',
        headers: _headers(),
        body: JSON.stringify({ auth_code: code }),
      });
      if (res.ok) {
        const data = await res.json();
        _saveSession(data);
        window.history.replaceState({}, '', window.location.pathname);
        return true;
      }
    }

    // Flujo implícito — token en el hash
    if (params.get('access_token')) {
      const session = {
        access_token:  params.get('access_token'),
        refresh_token: params.get('refresh_token'),
        expires_in:    Number(params.get('expires_in')),
        token_type:    params.get('token_type'),
      };
      _saveSession(session);
      // Limpiar el hash de la URL
      window.history.replaceState({}, '', window.location.pathname);
      // Obtener datos del usuario
      await auth.getUser();
      return true;
    }

    return false;
  },

  /**
   * Obtiene el usuario actual desde Supabase y lo agrega a la sesión.
   * @returns {Promise<Object|null>}
   */
  async getUser() {
    if (!_session?.access_token) return null;
    const res = await fetch(`${URL}/auth/v1/user`, {
      headers: _headers(),
    });
    if (!res.ok) { _saveSession(null); return null; }
    const user = await res.json();
    _session = { ..._session, user };
    _saveSession(_session);
    return user;
  },

  /** Cierra la sesión local y en Supabase. */
  async logout() {
    if (_session?.access_token) {
      await fetch(`${URL}/auth/v1/logout`, {
        method: 'POST',
        headers: _headers(),
      }).catch(() => {});
    }
    _saveSession(null);
  },

  /** Retorna la sesión activa o null. */
  getSession() { return _session; },

  /** Retorna el usuario activo o null. */
  currentUser() { return _session?.user ?? null; },

  /** true si hay sesión activa. */
  isLoggedIn() { return !!_session?.access_token; },
};

// ── REST API — tabla genérica ─────────────────────────────────────────────────

/**
 * Crea un cliente para una tabla de Supabase.
 * Soporta select, insert, update, delete con filtros.
 *
 * @param {string} table - nombre de la tabla
 * @returns {{ select, insert, update, delete: del }}
 *
 * @example
 * const habitos = db('habitos');
 * await habitos.select('*');
 * await habitos.insert({ titulo: 'Meditar', dias: [1,2,3] });
 * await habitos.update({ activo: false }, { id: 'eq.abc-123' });
 */
export function db(table) {
  const base = `${URL}/rest/v1/${table}`;

  async function _req(method, body, params = '') {
    const res = await fetch(`${base}${params}`, {
      method,
      headers: {
        ..._headers(),
        'Prefer': method === 'POST' ? 'return=representation' : 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`[supabase] ${method} ${table}: ${err.message ?? err.hint ?? res.status}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : [];
  }

  return {
    /**
     * SELECT — obtiene filas.
     * @param {string} [columns='*']
     * @param {Object} [filters] - ej: { user_id: 'eq.uuid', activo: 'eq.true' }
     * @param {string} [order] - ej: 'orden.asc'
     */
    async select(columns = '*', filters = {}, order = '') {
      let qs = `?select=${columns}`;
      for (const [k, v] of Object.entries(filters)) qs += `&${k}=${v}`;
      if (order) qs += `&order=${order}`;
      return _req('GET', null, qs);
    },

    /**
     * INSERT — inserta una o varias filas.
     * @param {Object|Object[]} data
     */
    async insert(data) {
      return _req('POST', data, '');
    },

    /**
     * UPDATE — actualiza filas que coinciden con los filtros.
     * @param {Object} data - campos a actualizar
     * @param {Object} filters - ej: { id: 'eq.abc-123' }
     */
    async update(data, filters = {}) {
      let qs = '?';
      for (const [k, v] of Object.entries(filters)) qs += `${k}=${v}&`;
      return _req('PATCH', data, qs);
    },

    /**
     * DELETE — elimina filas que coinciden con los filtros.
     * @param {Object} filters
     */
    async delete(filters = {}) {
      let qs = '?';
      for (const [k, v] of Object.entries(filters)) qs += `${k}=${v}&`;
      return _req('DELETE', null, qs);
    },
  };
}
