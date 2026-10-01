// net.timeline guestbook — what visitors chose to leave.
//
// GET  /api/guestbook            visible entries, newest first (?page=0)
// POST /api/guestbook            { session_id, name, message } — one entry per session
//
// Operator (header x-admin-key must equal the GUESTBOOK_ADMIN_KEY env var):
// GET  /api/guestbook?all=1      every entry, including held and hidden
// POST /api/guestbook            { action: 'show' | 'hide' | 'delete', id }
//
// Entries with links, slurs or profanity are held until the operator shows them.

export const config = { path: '/api/guestbook' };

const PAGE_SIZE = 30;
const MAX_MESSAGE = 280;

const ALLOWED_ORIGINS = [
  'https://h4nnah.net',
  'https://www.h4nnah.net',
  'http://localhost:8765',
  'http://127.0.0.1:8765'
];

// Deliberately short; extend as needed. Matching runs on a normalised copy
// of the text, so 'f4gg0t' and 'n1gg' are caught the same as the plain words.
const LINK_PATTERNS = [/https?:\/\//i, /www\./i, /\.(com|net|org|ru|xyz)\b/i];

// Written against text with repeated letters collapsed ("faggot" → "fagot").
// Slurs are also checked with spaces and symbols removed ("n 1 g g a").
const SLURS = [/nig(a|er|ah|uh)/, /fagot/, /\bfag\b/, /retard/, /trany|tranie/, /\bkike\b/, /\bspic\b/, /\bchink/, /kil\s*(yo)?ur\s*self/, /\bkys\b/];
const PROFANITY = [/\bcunt/, /whore/, /\bslut/, /\bfuck|\bfuk\b/, /\bshit\b/, /\bbitch/, /\bdick\b/, /\bcock\b/, /\bpusy\b|\bpusies\b/];

function normalise(text) {
  return text.toLowerCase()
    .replace(/[4@]/g, 'a').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e')
    .replace(/[5$]/g, 's').replace(/7/g, 't')
    .replace(/([a-z])\1+/g, '$1');
}

// Whole-word slurs only count when the squashed message is exactly that word,
// so "spicy" isn't caught by "spic".
function squashedMatch(re, squashed) {
  const src = re.source;
  if (src.indexOf('\\b') < 0) return re.test(squashed);
  return new RegExp('^(?:' + src.replace(/\\b/g, '') + ')$').test(squashed);
}

export function needsHold(text) {
  if (LINK_PATTERNS.some((re) => re.test(text))) return true;
  const n = normalise(text);
  const squashed = n.replace(/[^a-z]/g, '').replace(/([a-z])\1+/g, '$1');
  if (SLURS.some((re) => re.test(n) || squashedMatch(re, squashed))) return true;
  return PROFANITY.some((re) => re.test(n));
}

function cors(req) {
  const origin = req.headers.get('origin');
  return ALLOWED_ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, x-admin-key', Vary: 'Origin' }
    : {};
}

function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) }
  });
}

function clean(s, max) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function validate(body) {
  if (!body || typeof body !== 'object') return null;
  const session_id = typeof body.session_id === 'string' && /^[a-z0-9]{1,32}$/.test(body.session_id) ? body.session_id : null;
  const name = clean(body.name, 32);
  const message = typeof body.message === 'string' ? body.message.replace(/\r\n?/g, '\n').trim() : '';
  if (!session_id || !name || !message || message.length > MAX_MESSAGE) return null;
  return { session_id, name, message };
}

// Public view: first name only.
function publicEntry(e) {
  return { id: e.id, name: e.name.split(/\s+/)[0].slice(0, 16), message: e.message, created_at: e.created_at };
}

async function listEntries(store) {
  const { blobs } = await store.list({ prefix: 'entry/' });
  const keys = blobs.map((b) => b.key).sort().reverse();
  return (await Promise.all(keys.map((k) => store.get(k, { type: 'json' })))).filter(Boolean);
}

export async function handle(req, store, adminKey) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });

  const isAdmin = !!adminKey && req.headers.get('x-admin-key') === adminKey;
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const all = await listEntries(store);
    if (url.searchParams.get('all') === '1') {
      if (!isAdmin) return json(req, 403, { error: 'forbidden' });
      return json(req, 200, { entries: all });
    }
    const visible = all.filter((e) => e.status === 'visible');
    const page = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10) || 0);
    return json(req, 200, {
      total: visible.length,
      page,
      pages: Math.ceil(visible.length / PAGE_SIZE),
      entries: visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(publicEntry)
    });
  }

  if (req.method !== 'POST') return json(req, 405, { error: 'method not allowed' });

  let body;
  try { body = await req.json(); } catch { return json(req, 400, { error: 'bad json' }); }

  // Operator actions
  if (body && body.action) {
    if (!isAdmin) return json(req, 403, { error: 'forbidden' });
    if (typeof body.id !== 'string' || !/^[0-9TZ:.\-]+_[a-z0-9]+$/.test(body.id)) return json(req, 422, { error: 'bad id' });
    const key = 'entry/' + body.id;
    const entry = await store.get(key, { type: 'json' });
    if (!entry) return json(req, 404, { error: 'not found' });
    if (body.action === 'delete') {
      await store.delete(key);
      return json(req, 200, { ok: true });
    }
    if (body.action === 'show' || body.action === 'hide') {
      entry.status = body.action === 'show' ? 'visible' : 'hidden';
      await store.setJSON(key, entry);
      return json(req, 200, { ok: true, entry });
    }
    return json(req, 422, { error: 'unknown action' });
  }

  // A visitor signing
  const entry = validate(body);
  if (!entry) return json(req, 422, { error: 'invalid entry' });
  const marker = 'session/' + entry.session_id;
  if (await store.get(marker)) return json(req, 409, { error: 'already signed' });

  const created_at = new Date().toISOString();
  const id = created_at + '_' + entry.session_id;
  const status = needsHold(entry.name + ' ' + entry.message) ? 'held' : 'visible';
  const record = { id, ...entry, created_at, status };
  await store.setJSON('entry/' + id, record);
  await store.set(marker, id);
  return json(req, 200, { ok: true, status, entry: status === 'visible' ? publicEntry(record) : null });
}

export default async (req) => {
  const { getStore } = await import('@netlify/blobs');
  return handle(req, getStore({ name: 'guestbook', consistency: 'strong' }), process.env.GUESTBOOK_ADMIN_KEY);
};
