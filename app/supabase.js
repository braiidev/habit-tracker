// habit-tracker/app/supabase.js
const SUPA_URL  = 'https://pnkfurfokxmmwfalknnh.supabase.co';
const SUPA_KEY  = 'sb_publishable_ITR0YdKZI9v7Hs187qh2dA_LV6wPLGr';
const SESSION_KEY = 'nano:sb:session';

let _session = null;

function _loadSession() {
  try { const r = localStorage.getItem(SESSION_KEY); if (r) _session = JSON.parse(r); }
  catch { _session = null; }
}
function _saveSession(s) {
  _session = s;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else   localStorage.removeItem(SESSION_KEY);
}
_loadSession();

function _headers() {
  const h = { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' };
  if (_session?.access_token) h['Authorization'] = `Bearer ${_session.access_token}`;
  return h;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export const auth = {
  async loginWith(provider) {
    const redirectTo = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `${SUPA_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${redirectTo}`;
  },

  async handleRedirect() {
    const params = new URLSearchParams(window.location.hash.replace('#', ''));
    const code   = new URLSearchParams(window.location.search).get('code');

    if (code) {
      const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=pkce`, {
        method: 'POST', headers: _headers(), body: JSON.stringify({ auth_code: code }),
      });
      if (res.ok) {
        _saveSession(await res.json());
        window.history.replaceState({}, '', window.location.pathname);
        return true;
      }
    }

    if (params.get('access_token')) {
      _saveSession({
        access_token:  params.get('access_token'),
        refresh_token: params.get('refresh_token'),
        expires_in:    Number(params.get('expires_in')),
        token_type:    params.get('token_type'),
      });
      window.history.replaceState({}, '', window.location.pathname);
      await auth.getUser();
      return true;
    }
    return false;
  },

  async getUser() {
    if (!_session?.access_token) return null;
    const res = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: _headers() });
    if (!res.ok) { _saveSession(null); return null; }
    const user = await res.json();
    _session = { ..._session, user };
    _saveSession(_session);
    return user;
  },

  async logout() {
    if (_session?.access_token) {
      await fetch(`${SUPA_URL}/auth/v1/logout`, { method: 'POST', headers: _headers() }).catch(() => {});
    }
    _saveSession(null);
  },

  getSession()  { return _session; },
  currentUser() { return _session?.user ?? null; },
  isLoggedIn()  { return !!_session?.access_token; },
};

// ── REST db() ──────────────────────────────────────────────────────────────

export function db(table) {
  const base = `${SUPA_URL}/rest/v1/${table}`;

  async function req(method, body, qs = '') {
    const opts = {
      method,
      headers: { ..._headers(), 'Prefer': 'return=representation' },
    };
    if (body !== null) opts.body = JSON.stringify(body);

    const res  = await fetch(base + qs, opts);
    const text = await res.text();
    const data = text ? JSON.parse(text) : [];

    if (!res.ok) throw new Error(`[supabase] ${data?.message ?? data?.hint ?? res.status}`);

    return data;
  }

  return {
    async select(cols = '*', filters = {}, order = '') {
      let qs = `?select=${cols}`;
      for (const [k, v] of Object.entries(filters)) qs += `&${k}=${v}`;
      if (order) qs += `&order=${order}`;
      return req('GET', null, qs);
    },

    async insert(data) {
      return req('POST', data, '?select=*');
    },

    async update(data, filters = {}) {
      let qs = '?';
      for (const [k, v] of Object.entries(filters)) qs += `${k}=${v}&`;
      return req('PATCH', data, qs);
    },

    async delete(filters = {}) {
      let qs = '?';
      for (const [k, v] of Object.entries(filters)) qs += `${k}=${v}&`;
      return req('DELETE', null, qs);
    },
  };
}
