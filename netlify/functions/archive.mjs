// net.timeline archive — the permanent record of visits.
//
// POST /api/archive   store one finished session's summary (idempotent by session_id)
// GET  /api/archive   public traces, newest first (?page=0)
//
// Only the fields the Terms of Existence disclose are accepted. Detailed
// behaviour (clicks, timings, camera, etc.) never reaches this function.

export const config = { path: '/api/archive' };

const PAGE_SIZE = 20;

const ALLOWED_ORIGINS = [
  'https://h4nnah.net',
  'https://www.h4nnah.net',
  'http://localhost:8765',
  'http://127.0.0.1:8765'
];

function cors(req) {
  const origin = req.headers.get('origin');
  return ALLOWED_ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {};
}

function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) }
  });
}

const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const isDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const int = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

// Returns a clean record, or null if anything is off.
export function validate(r) {
  if (!r || typeof r !== 'object') return null;
  if (!str(r.session_id, 32) || !/^[a-z0-9]+$/.test(r.session_id)) return null;
  if (!str(r.exhibition_id, 64)) return null;
  if (!str(r.name, 32)) return null;
  if (r.terms !== 'accepted' && r.terms !== 'declined') return null;
  if (!isDate(r.started_at) || !isDate(r.ended_at)) return null;
  if (!int(r.duration_s, 60 * 60 * 24)) return null;
  if (!int(r.portals_visited, 100)) return null;
  if (typeof r.left_something !== 'boolean') return null;
  if (r.ended_by !== 'visitor' && r.ended_by !== 'idle') return null;
  return {
    session_id: r.session_id,
    exhibition_id: r.exhibition_id,
    name: r.name,
    terms: r.terms,
    started_at: r.started_at,
    ended_at: r.ended_at,
    duration_s: r.duration_s,
    portals_visited: r.portals_visited,
    left_something: r.left_something,
    ended_by: r.ended_by
  };
}

// What the public archive is allowed to show: first name only, no terms choice.
export function trace(r) {
  return {
    session_id: r.session_id,
    exhibition_id: r.exhibition_id,
    name: r.name.trim().split(/\s+/)[0].slice(0, 16),
    started_at: r.started_at,
    ended_at: r.ended_at,
    duration_s: r.duration_s,
    left_something: r.left_something,
    ended_by: r.ended_by
  };
}

export async function handle(req, store) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json(req, 400, { error: 'bad json' }); }
    const record = validate(body);
    if (!record) return json(req, 422, { error: 'invalid record' });
    // Keys sort by end time, so listing is already roughly chronological.
    await store.setJSON(record.ended_at + '_' + record.session_id, record);
    return json(req, 200, { ok: true });
  }

  if (req.method === 'GET') {
    const page = Math.max(0, parseInt(new URL(req.url).searchParams.get('page') || '0', 10) || 0);
    const { blobs } = await store.list();
    const keys = blobs.map((b) => b.key).sort().reverse();
    const slice = keys.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const records = (await Promise.all(slice.map((k) => store.get(k, { type: 'json' })))).filter(Boolean);
    return json(req, 200, {
      total: keys.length,
      page,
      pages: Math.ceil(keys.length / PAGE_SIZE),
      visitors: records.map(trace)
    });
  }

  return json(req, 405, { error: 'method not allowed' });
}

export default async (req) => {
  const { getStore } = await import('@netlify/blobs');
  return handle(req, getStore({ name: 'archive', consistency: 'strong' }));
};
