const enc = new TextEncoder();
const dec = new TextDecoder();
const BASE_URL = 'https://quartzwebsolutions.com';
const ADMIN_URL = 'https://admin.quartzwebsolutions.com';

// Static Quartz pages are intentionally listed without a fake <lastmod> value.
// Google says lastmod should only be sent when it is accurate. Connected-site
// pages below get real automatic lastmod values from D1/R2.
const STATIC_SITEMAP_PATHS = [
  '/',
  '/sabith-salah-kp/',
  '/services/website-development/',
  '/services/web-app-development/',
  '/services/ecommerce-development/',
  '/services/ui-ux-design/',
  '/services/seo-performance/',
  '/services/website-for-shops/',
  '/services/business-websites/',
  '/services/local-seo-websites/',
  '/locations/kerala/',
  '/locations/malappuram/',
  '/locations/calicut/'
];

const ALLOWED_BUSINESS_TYPES = new Set([
  'LocalBusiness','Store','Restaurant','Bakery','FurnitureStore','ClothingStore',
  'ElectronicsStore','MobilePhoneStore','ConvenienceStore','GroceryStore','HardwareStore',
  'HomeGoodsStore','JewelryStore','ShoeStore','SportingGoodsStore','ToyStore',
  'AutoRepair','AutoPartsStore','BeautySalon','HairSalon','HealthAndBeautyBusiness',
  'TravelAgency','ProfessionalService','RealEstateAgent','Dentist','MedicalBusiness',
  'Pharmacy','Florist','PetStore','BookStore','ComputerStore','CafeOrCoffeeShop',
  'FastFoodRestaurant','IceCreamShop','BarOrPub','Hotel','LodgingBusiness'
]);

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});
const bad = (message, status = 400) => json({ ok: false, error: message }, status);

function base64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value))));
}
function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  const found = cookie.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
  return found ? found.slice(name.length + 1) : '';
}
async function createSession(env) {
  if (!env.ADMIN_SESSION_SECRET) throw new Error('ADMIN_SESSION_SECRET is not configured');
  const payload = JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000, role: 'admin' });
  const p = base64url(enc.encode(payload));
  const sig = await hmac(p, env.ADMIN_SESSION_SECRET);
  return `${p}.${sig}`;
}
async function isAdmin(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return false;
  const token = getCookie(request, 'quartz_admin');
  if (!token || !token.includes('.')) return false;
  const [p, sig] = token.split('.');
  if ((await hmac(p, env.ADMIN_SESSION_SECRET)) !== sig) return false;
  try {
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
    const payload = JSON.parse(dec.decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0))));
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch { return false; }
}

async function ensureSchema(env) {
  if (!env.DB) throw new Error('D1 binding DB is not configured');
  // D1 exec() treats newline-separated input as separate statements. Keep the
  // multi-line CREATE TABLE as one prepared statement so it is not split at
  // `CREATE TABLE ... (` and reported as an incomplete query.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS connected_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    logo_path TEXT DEFAULT '',
    seo_title TEXT DEFAULT '',
    seo_description TEXT DEFAULT '',
    primary_keyword TEXT DEFAULT '',
    keywords_json TEXT DEFAULT '[]',
    category TEXT DEFAULT '',
    business_type TEXT DEFAULT 'LocalBusiness',
    city TEXT DEFAULT '',
    district TEXT DEFAULT '',
    state TEXT DEFAULT 'Kerala',
    country_code TEXT DEFAULT 'IN',
    address TEXT DEFAULT '',
    postal_code TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    whatsapp TEXT DEFAULT '',
    email TEXT DEFAULT '',
    opening_hours_json TEXT DEFAULT '[]',
    maps_url TEXT DEFAULT '',
    instagram_url TEXT DEFAULT '',
    facebook_url TEXT DEFAULT '',
    youtube_url TEXT DEFAULT '',
    business_description TEXT DEFAULT '',
    services_json TEXT DEFAULT '[]',
    index_html TEXT NOT NULL DEFAULT '<!doctype html><html><head><title>New Website</title></head><body></body></html>',
    deployed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_connected_sites_slug ON connected_sites(slug)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_connected_sites_status ON connected_sites(status)').run();

  // Safe automatic migration for databases created by earlier Quartz builds.
  const info = await env.DB.prepare('PRAGMA table_info(connected_sites)').all();
  const existing = new Set((info.results || []).map(r => r.name));
  const migrations = [
    ['business_type', `TEXT DEFAULT 'LocalBusiness'`],
    ['country_code', `TEXT DEFAULT 'IN'`],
    ['postal_code', `TEXT DEFAULT ''`],
    ['email', `TEXT DEFAULT ''`],
    ['opening_hours_json', `TEXT DEFAULT '[]'`],
    ['maps_url', `TEXT DEFAULT ''`],
    ['instagram_url', `TEXT DEFAULT ''`],
    ['facebook_url', `TEXT DEFAULT ''`],
    ['youtube_url', `TEXT DEFAULT ''`]
  ];
  for (const [name, type] of migrations) {
    if (existing.has(name)) continue;
    try { await env.DB.exec(`ALTER TABLE connected_sites ADD COLUMN ${name} ${type};`); }
    catch (e) { if (!String(e).toLowerCase().includes('duplicate column')) throw e; }
  }
}

function normalizeSlug(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function parseList(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value || '').split(/[\n,]+/).map(v => v.trim()).filter(Boolean);
}
function cleanUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  try {
    const u = new URL(v.startsWith('http') ? v : `https://${v}`);
    return ['http:','https:'].includes(u.protocol) ? u.toString() : '';
  } catch { return ''; }
}
function normalizeBusinessType(value) {
  const v = String(value || 'LocalBusiness').trim();
  return ALLOWED_BUSINESS_TYPES.has(v) ? v : 'LocalBusiness';
}
function sanitizeSiteInput(body) {
  const slug = normalizeSlug(body.slug || body.name);
  const status = body.status === 'published' ? 'published' : 'draft';
  return {
    slug,
    name: String(body.name || '').trim().slice(0, 180),
    status,
    logo_path: String(body.logo_path || '').trim().slice(0, 400),
    seo_title: String(body.seo_title || '').trim().slice(0, 180),
    seo_description: String(body.seo_description || '').trim().slice(0, 400),
    primary_keyword: String(body.primary_keyword || '').trim().slice(0, 180),
    keywords_json: JSON.stringify(parseList(body.keywords).slice(0, 100)),
    category: String(body.category || '').trim().slice(0, 120),
    business_type: normalizeBusinessType(body.business_type),
    city: String(body.city || '').trim().slice(0, 120),
    district: String(body.district || '').trim().slice(0, 120),
    state: String(body.state || 'Kerala').trim().slice(0, 120),
    country_code: String(body.country_code || 'IN').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'IN',
    address: String(body.address || '').trim().slice(0, 500),
    postal_code: String(body.postal_code || '').trim().slice(0, 30),
    phone: String(body.phone || '').trim().slice(0, 60),
    whatsapp: String(body.whatsapp || '').trim().slice(0, 60),
    email: String(body.email || '').trim().slice(0, 180),
    opening_hours_json: JSON.stringify(parseList(body.opening_hours).slice(0, 30)),
    maps_url: cleanUrl(body.maps_url).slice(0, 500),
    instagram_url: cleanUrl(body.instagram_url).slice(0, 500),
    facebook_url: cleanUrl(body.facebook_url).slice(0, 500),
    youtube_url: cleanUrl(body.youtube_url).slice(0, 500),
    business_description: String(body.business_description || '').trim().slice(0, 3000),
    services_json: JSON.stringify(parseList(body.services).slice(0, 80)),
    index_html: String(body.index_html || '').slice(0, 2_000_000)
  };
}
function rowToSite(row) {
  if (!row) return null;
  return {
    ...row,
    keywords: (() => { try { return JSON.parse(row.keywords_json || '[]'); } catch { return []; } })(),
    services: (() => { try { return JSON.parse(row.services_json || '[]'); } catch { return []; } })(),
    opening_hours: (() => { try { return JSON.parse(row.opening_hours_json || '[]'); } catch { return []; } })()
  };
}

const SITE_COLUMNS = `slug,name,status,logo_path,seo_title,seo_description,primary_keyword,keywords_json,category,business_type,city,district,state,country_code,address,postal_code,phone,whatsapp,email,opening_hours_json,maps_url,instagram_url,facebook_url,youtube_url,business_description,services_json,index_html,deployed_at,created_at,updated_at`;

async function handleAdminApi(request, env, url) {
  const pathname = url.pathname;
  if (url.hostname !== 'admin.quartzwebsolutions.com') return bad('Admin API is available only on admin.quartzwebsolutions.com', 404);
  const origin = request.headers.get('origin');
  if (origin && origin !== ADMIN_URL) return bad('Invalid admin origin', 403);

  if (pathname === '/api/admin/login' && request.method === 'POST') {
    if (!env.ADMIN_SESSION_SECRET) return bad('Server is missing ADMIN_SESSION_SECRET. Add it in Cloudflare Pages → Settings → Variables and Secrets.', 500);
    const body = await request.json().catch(() => ({}));
    const expected = env.ADMIN_LOGIN_ID || 'quartex';
    if (String(body.loginId || '').trim() !== expected) return bad('Invalid login ID', 401);
    const token = await createSession(env);
    return json({ ok: true }, 200, { 'set-cookie': `quartz_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200` });
  }
  if (pathname === '/api/admin/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': 'quartz_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
  }
  if (!(await isAdmin(request, env))) return bad('Unauthorized', 401);
  if (pathname === '/api/admin/me') return json({ ok: true, loginId: env.ADMIN_LOGIN_ID || 'quartex' });

  await ensureSchema(env);

  if (pathname === '/api/sites' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    let result;
    if (q) {
      result = await env.DB.prepare(`SELECT id,slug,name,status,logo_path,seo_title,primary_keyword,category,business_type,city,district,deployed_at,created_at,updated_at FROM connected_sites WHERE name LIKE ? OR slug LIKE ? OR primary_keyword LIKE ? OR category LIKE ? OR city LIKE ? ORDER BY updated_at DESC`).bind(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`).all();
    } else {
      result = await env.DB.prepare(`SELECT id,slug,name,status,logo_path,seo_title,primary_keyword,category,business_type,city,district,deployed_at,created_at,updated_at FROM connected_sites ORDER BY updated_at DESC`).all();
    }
    return json({ ok: true, sites: result.results || [] });
  }

  if (pathname === '/api/sites' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const s = sanitizeSiteInput(body);
    if (!s.name || !s.slug || !s.index_html) return bad('Name, URL slug and index.html are required');
    const now = new Date().toISOString();
    try {
      const values = [s.slug,s.name,s.status,s.logo_path,s.seo_title,s.seo_description,s.primary_keyword,s.keywords_json,s.category,s.business_type,s.city,s.district,s.state,s.country_code,s.address,s.postal_code,s.phone,s.whatsapp,s.email,s.opening_hours_json,s.maps_url,s.instagram_url,s.facebook_url,s.youtube_url,s.business_description,s.services_json,s.index_html,s.status==='published'?now:null,now,now];
      const marks = values.map(() => '?').join(',');
      const r = await env.DB.prepare(`INSERT INTO connected_sites (${SITE_COLUMNS}) VALUES (${marks}) RETURNING *`).bind(...values).first();
      return json({ ok: true, site: rowToSite(r) }, 201);
    } catch (e) {
      if (String(e).toLowerCase().includes('unique')) return bad('That URL slug is already used', 409);
      return bad(String(e), 500);
    }
  }

  const siteMatch = pathname.match(/^\/api\/sites\/(\d+)$/);
  if (siteMatch) {
    const id = Number(siteMatch[1]);
    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM connected_sites WHERE id=?').bind(id).first();
      return row ? json({ ok: true, site: rowToSite(row) }) : bad('Site not found', 404);
    }
    if (request.method === 'PUT') {
      const existing = await env.DB.prepare('SELECT * FROM connected_sites WHERE id=?').bind(id).first();
      if (!existing) return bad('Site not found', 404);
      const body = await request.json().catch(() => ({}));
      const s = sanitizeSiteInput({ ...rowToSite(existing), ...body });
      if (!s.name || !s.slug || !s.index_html) return bad('Name, URL slug and index.html are required');
      const now = new Date().toISOString();
      const deployed = s.status === 'published' ? (existing.deployed_at || now) : existing.deployed_at;
      try {
        const row = await env.DB.prepare(`UPDATE connected_sites SET slug=?,name=?,status=?,logo_path=?,seo_title=?,seo_description=?,primary_keyword=?,keywords_json=?,category=?,business_type=?,city=?,district=?,state=?,country_code=?,address=?,postal_code=?,phone=?,whatsapp=?,email=?,opening_hours_json=?,maps_url=?,instagram_url=?,facebook_url=?,youtube_url=?,business_description=?,services_json=?,index_html=?,deployed_at=?,updated_at=? WHERE id=? RETURNING *`)
          .bind(s.slug,s.name,s.status,s.logo_path,s.seo_title,s.seo_description,s.primary_keyword,s.keywords_json,s.category,s.business_type,s.city,s.district,s.state,s.country_code,s.address,s.postal_code,s.phone,s.whatsapp,s.email,s.opening_hours_json,s.maps_url,s.instagram_url,s.facebook_url,s.youtube_url,s.business_description,s.services_json,s.index_html,deployed,now,id).first();
        return json({ ok: true, site: rowToSite(row) });
      } catch (e) {
        if (String(e).toLowerCase().includes('unique')) return bad('That URL slug is already used', 409);
        return bad(String(e), 500);
      }
    }
    if (request.method === 'DELETE') {
      if (env.SITES_BUCKET) {
        let cursor;
        do {
          const list = await env.SITES_BUCKET.list({ prefix: `sites/${id}/`, cursor });
          if (list.objects.length) await env.SITES_BUCKET.delete(list.objects.map(o => o.key));
          cursor = list.truncated ? list.cursor : undefined;
        } while (cursor);
      }
      await env.DB.prepare('DELETE FROM connected_sites WHERE id=?').bind(id).run();
      return json({ ok: true });
    }
  }

  const assetsMatch = pathname.match(/^\/api\/sites\/(\d+)\/assets$/);
  if (assetsMatch) {
    if (!env.SITES_BUCKET) return bad('R2 binding SITES_BUCKET is not configured', 500);
    const id = Number(assetsMatch[1]);
    const site = await env.DB.prepare('SELECT id,slug FROM connected_sites WHERE id=?').bind(id).first();
    if (!site) return bad('Site not found', 404);
    if (request.method === 'GET') {
      const assets = [];
      let cursor;
      do {
        const result = await env.SITES_BUCKET.list({ prefix: `sites/${id}/`, cursor, limit: 1000 });
        for (const o of result.objects) assets.push({ path:o.key.slice(`sites/${id}/`.length), size:o.size, uploaded:o.uploaded });
        cursor = result.truncated ? result.cursor : undefined;
      } while (cursor);
      return json({ ok: true, assets });
    }
    const rawPath = decodeURIComponent(url.searchParams.get('path') || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rawPath || rawPath.includes('..')) return bad('Invalid asset path');
    const key = `sites/${id}/${rawPath}`;
    const now = new Date().toISOString();
    if (request.method === 'PUT') {
      const type = request.headers.get('content-type') || guessType(rawPath);
      await env.SITES_BUCKET.put(key, request.body, { httpMetadata: { contentType: type } });
      await env.DB.prepare('UPDATE connected_sites SET updated_at=? WHERE id=?').bind(now,id).run();
      return json({ ok: true, path: rawPath, url: `${BASE_URL}/${site.slug}/${rawPath}` });
    }
    if (request.method === 'DELETE') {
      await env.SITES_BUCKET.delete(key);
      await env.DB.prepare('UPDATE connected_sites SET updated_at=? WHERE id=?').bind(now,id).run();
      return json({ ok: true });
    }
  }

  return bad('API route not found', 404);
}

function escapeXml(value) { return String(value).replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','\"':'&quot;'}[c])); }
function validDate(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}
function laterDate(a, b) {
  const da = validDate(a), db = validDate(b);
  if (!da) return db; if (!db) return da; return da > db ? da : db;
}
function dateOnly(value) {
  const d = validDate(value);
  return d ? d.toISOString().slice(0,10) : '';
}
function cleanPageRouteFromAsset(assetPath) {
  let p = String(assetPath || '').replace(/^\/+/, '').replace(/\\/g, '/');
  if (!/\.html?$/i.test(p)) return '';
  if (/^index\.html?$/i.test(p)) return '';
  if (/\/index\.html?$/i.test(p)) {
    p = p.replace(/\/index\.html?$/i, '').replace(/^\/+|\/+$/g, '');
    return p ? `${p}/` : '';
  }
  return p.replace(/^\/+/, '');
}

async function sitemap(env) {
  let sites = [];
  if (env.DB) {
    try {
      await ensureSchema(env);
      const r = await env.DB.prepare(`SELECT id,slug,updated_at FROM connected_sites WHERE status='published' ORDER BY updated_at DESC`).all();
      sites = r.results || [];
    } catch {}
  }
  const urls = STATIC_SITEMAP_PATHS.map(path => ({ loc:`${BASE_URL}${path}`, lastmod:'' }));

  for (const site of sites) {
    urls.push({ loc:`${BASE_URL}/${site.slug}/`, lastmod:dateOnly(site.updated_at) });
    if (!env.SITES_BUCKET) continue;
    const seen = new Map();
    let cursor;
    do {
      const list = await env.SITES_BUCKET.list({ prefix:`sites/${site.id}/`, cursor, limit:1000 });
      for (const obj of list.objects) {
        const rel = obj.key.slice(`sites/${site.id}/`.length);
        const route = cleanPageRouteFromAsset(rel);
        if (!route) continue;
        const previous = seen.get(route);
        const lm = laterDate(obj.uploaded, site.updated_at);
        if (!previous || (lm && lm > previous)) seen.set(route, lm);
      }
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
    for (const [route, lm] of seen) urls.push({ loc:`${BASE_URL}/${site.slug}/${route}`, lastmod:dateOnly(lm) });
  }

  const unique = new Map();
  for (const u of urls) unique.set(u.loc, u);
  const rows = [...unique.values()].map(u => `<url><loc>${escapeXml(u.loc)}</loc>${u.lastmod?`<lastmod>${escapeXml(u.lastmod)}</lastmod>`:''}</url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>`;
  return new Response(xml, { headers:{ 'content-type':'application/xml; charset=utf-8', 'cache-control':'public, max-age=60, must-revalidate' } });
}

function guessType(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return ({ html:'text/html; charset=utf-8', htm:'text/html; charset=utf-8', css:'text/css; charset=utf-8', js:'application/javascript; charset=utf-8', mjs:'application/javascript; charset=utf-8', json:'application/json; charset=utf-8', svg:'image/svg+xml', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif', ico:'image/x-icon', woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', pdf:'application/pdf', txt:'text/plain; charset=utf-8' })[ext] || 'application/octet-stream';
}
function replaceOrInsert(head, regex, replacement) {
  if (regex.test(head)) return head.replace(regex, replacement);
  return head + '\n' + replacement;
}
function rewriteRootRelative(htmlText, slug) {
  return htmlText
    .replace(/\b(src|href|action)=(['"])\/(?!\/|api\/|admin\/|asset\/|services\/|locations\/|sabith-salah-kp\/|#)/gi, `$1=$2/${slug}/`)
    .replace(/\b(srcset)=(['"])\/(?!\/)/gi, `$1=$2/${slug}/`);
}
function stripTags(value) {
  return String(value || '').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
}
function extractTag(html, tag) {
  const m = String(html || '').match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? stripTags(m[1]) : '';
}
function extractMetaDescription(html) {
  const a = String(html||'').match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const b = String(html||'').match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  return stripTags((a||b||[])[1]||'');
}
function humanizeSegment(seg) {
  return decodeURIComponent(String(seg||'')).replace(/\.(html?|php)$/i,'').replace(/[-_]+/g,' ').replace(/\b\w/g, c=>c.toUpperCase()).trim();
}
function canonicalPathForAsset(slug, assetPath='') {
  let rel = String(assetPath || '').replace(/^\/+/, '').replace(/\\/g,'/');
  if (!rel || /^index\.html?$/i.test(rel)) return `/${slug}/`;
  if (/\/index\.html?$/i.test(rel)) {
    rel = rel.replace(/\/index\.html?$/i,'').replace(/^\/+|\/+$/g,'');
    return rel ? `/${slug}/${rel}/` : `/${slug}/`;
  }
  return `/${slug}/${rel}`;
}
function pathSegmentsFromCanonical(canonical, siteSlug) {
  const u = new URL(canonical);
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts[0] === siteSlug) parts.shift();
  return parts;
}
function pageSeo(site, htmlText, canonical) {
  const rootCanonical = `${BASE_URL}/${site.slug}/`;
  const isRoot = canonical === rootCanonical;
  const originalTitle = extractTag(htmlText,'title');
  const h1 = extractTag(htmlText,'h1');
  const originalDesc = extractMetaDescription(htmlText);
  const segments = pathSegmentsFromCanonical(canonical, site.slug);
  const pageLabel = h1 || (segments.length ? humanizeSegment(segments[segments.length-1]) : site.name);
  const genericTitles = new Set(['business website','new website','home','homepage']);

  let title;
  if (isRoot) title = site.seo_title || `${site.name}${site.city ? ` | ${site.category || 'Business'} in ${site.city}` : ''}`;
  else if (originalTitle && !genericTitles.has(originalTitle.toLowerCase())) title = originalTitle.toLowerCase().includes(String(site.name).toLowerCase()) ? originalTitle : `${originalTitle} | ${site.name}`;
  else title = `${pageLabel || 'Business'} | ${site.name}${site.city ? ` ${site.city}` : ''}`;

  let description;
  if (isRoot) description = site.seo_description || site.business_description || `${site.name}${site.city?` in ${site.city}`:''}${site.district?`, ${site.district}`:''}. View services, location and contact details.`;
  else description = originalDesc || `${pageLabel || 'Information'} from ${site.name}${site.city?` in ${site.city}`:''}${site.district?`, ${site.district}`:''}. ${site.business_description || `View details, services and contact information.`}`;
  description = stripTags(description).slice(0, 320);
  return { title:title.slice(0,180), description, isRoot, pageLabel, rootCanonical, segments };
}
function schemaGraph(site, seo, canonical, logo) {
  const keywords = (()=>{try{return JSON.parse(site.keywords_json||'[]')}catch{return[]}})();
  const services = (()=>{try{return JSON.parse(site.services_json||'[]')}catch{return[]}})();
  const openingHours = (()=>{try{return JSON.parse(site.opening_hours_json||'[]')}catch{return[]}})();
  const sameAs = [site.instagram_url,site.facebook_url,site.youtube_url].filter(Boolean);
  const hasAddress = site.address || site.city || site.district || site.postal_code;
  const business = {
    '@type': normalizeBusinessType(site.business_type),
    '@id': seo.rootCanonical + '#business',
    name: site.name,
    url: seo.rootCanonical,
    image: logo,
    logo,
    description: site.business_description || seo.description,
    telephone: site.phone || undefined,
    email: site.email || undefined,
    hasMap: site.maps_url || undefined,
    openingHours: openingHours.length ? openingHours : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    address: hasAddress ? {
      '@type':'PostalAddress',
      streetAddress:site.address||undefined,
      addressLocality:site.city||undefined,
      addressRegion:site.state||site.district||'Kerala',
      postalCode:site.postal_code||undefined,
      addressCountry:site.country_code||'IN'
    } : undefined,
    areaServed:[site.city,site.district,site.state].filter(Boolean),
    knowsAbout:[...new Set([site.primary_keyword,...keywords,...services].filter(Boolean))].slice(0,40),
    hasOfferCatalog: services.length ? {
      '@type':'OfferCatalog',
      name:`${site.name} services`,
      itemListElement:services.slice(0,30).map(name=>({'@type':'Offer','itemOffered':{'@type':'Service','name':name}}))
    } : undefined
  };
  const breadcrumbs = [
    {'@type':'ListItem',position:1,name:'Quartz Web Solutions',item:BASE_URL+'/'},
    {'@type':'ListItem',position:2,name:site.name,item:seo.rootCanonical}
  ];
  let builtPath = `/${site.slug}/`;
  seo.segments.forEach((seg,i)=>{
    const isFile = i === seo.segments.length - 1 && /\.[a-z0-9]{1,8}$/i.test(seg);
    builtPath += `${encodeURIComponent(seg)}${isFile?'':'/'}`;
    breadcrumbs.push({'@type':'ListItem',position:i+3,name:humanizeSegment(seg),item:BASE_URL+builtPath});
  });
  return {
    '@context':'https://schema.org',
    '@graph':[
      business,
      {
        '@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:seo.title,description:seo.description,inLanguage:'en-IN',
        about:{'@id':seo.rootCanonical+'#business'},
        mainEntity:seo.isRoot?{'@id':seo.rootCanonical+'#business'}:undefined,
        keywords:[site.primary_keyword,...keywords].filter(Boolean).join(', ') || undefined,
        breadcrumb:{'@id':canonical+'#breadcrumb'}
      },
      {'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:breadcrumbs}
    ]
  };
}
function siteLogoUrl(site) {
  return site.logo_path
    ? `${BASE_URL}/${site.slug}/${String(site.logo_path).replace(/^\/+/, '')}`
    : `${BASE_URL}/asset/img/fav/icon-512.png`;
}
function siteLogo192Url(site) {
  return site.logo_path === 'quartz-logo.webp'
    ? `${BASE_URL}/${site.slug}/quartz-logo-192.webp`
    : (site.logo_path ? siteLogoUrl(site) : `${BASE_URL}/asset/img/fav/icon-192.png`);
}
function logoMimeType(site) {
  const t = guessType(site.logo_path || 'icon-512.png');
  return String(t || '').split(';')[0] || 'image/png';
}
function connectedManifest(site) {
  const logo = siteLogoUrl(site);
  const icon192 = siteLogo192Url(site);
  const scope = `/${site.slug}/`;
  const manifest = {
    id: scope,
    name: site.name,
    short_name: String(site.name || 'Website').slice(0, 32),
    description: site.business_description || site.seo_description || `${site.name} website`,
    start_url: scope,
    scope,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'en-IN',
    icons: [
      { src: icon192, sizes: '192x192', type: logoMimeType(site), purpose: 'any' },
      { src: logo, sizes: '512x512', type: logoMimeType(site), purpose: 'any maskable' }
    ]
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=60, must-revalidate'
    }
  });
}
function connectedServiceWorker(site) {
  const scope = `/${site.slug}/`;
  const version = String(site.updated_at || site.deployed_at || '1').replace(/[^a-z0-9]/gi, '').slice(-28) || '1';
  const prefix = `quartz-site-${site.id}-`;
  const cacheName = `${prefix}${version}`;
  const code = `
const CACHE_NAME=${JSON.stringify(cacheName)};
const CACHE_PREFIX=${JSON.stringify(prefix)};
const SITE_SCOPE=${JSON.stringify(scope)};
const CORE=[SITE_SCOPE,SITE_SCOPE+'manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(SITE_SCOPE)||url.pathname.endsWith('/sw.js'))return;
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(req);
      if(fresh&&fresh.ok){const cache=await caches.open(CACHE_NAME);cache.put(req,fresh.clone()).catch(()=>{});}
      return fresh;
    }catch(err){
      const cached=await caches.match(req);
      if(cached)return cached;
      if(req.mode==='navigate')return (await caches.match(SITE_SCOPE))||Response.error();
      return Response.error();
    }
  })());
});`;
  return new Response(code, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-store, must-revalidate',
      'service-worker-allowed': scope
    }
  });
}
function injectSeo(site, htmlText, canonical) {
  const seo = pageSeo(site, htmlText, canonical);
  const logo = siteLogoUrl(site);
  const manifestUrl = `${BASE_URL}/${site.slug}/manifest.webmanifest`;
  const swUrl = `/${site.slug}/sw.js`;
  const schemaText = JSON.stringify(schemaGraph(site,seo,canonical,logo)).replace(/<\//g,'<\\/');
  let out = htmlText || '<!doctype html><html><head></head><body></body></html>';
  out = rewriteRootRelative(out, site.slug);
  if (!/<html[\s>]/i.test(out)) out = `<!doctype html><html lang="en-IN"><head></head><body>${out}</body></html>`;
  else if (!/<html[^>]*\slang=/i.test(out)) out = out.replace(/<html([^>]*)>/i,'<html$1 lang="en-IN">');
  if (!/<head[\s>]/i.test(out)) out = out.replace(/<html[^>]*>/i, m => `${m}<head></head>`);

  out = out.replace(/<script[^>]+data-quartz-pwa=["']true["'][^>]*>[\s\S]*?<\/script>\s*/gi,'');

  out = out.replace(/<head([^>]*)>([\s\S]*?)<\/head>/i, (whole, attrs, head) => {
    head = head.replace(/<meta\s+[^>]*name=["']keywords["'][^>]*>\s*/gi,'');
    head = head.replace(/<script[^>]+data-quartz-seo=["']true["'][^>]*>[\s\S]*?<\/script>\s*/gi,'');
    head = head.replace(/<link\b(?=[^>]*\brel=["'][^"']*(?:icon|manifest|apple-touch-icon)[^"']*["'])[^>]*>\s*/gi,'');
    head = head.replace(/<meta\s+name=["'](?:theme-color|mobile-web-app-capable|apple-mobile-web-app-capable|apple-mobile-web-app-title)["'][^>]*>\s*/gi,'');
    head = replaceOrInsert(head, /<meta\s+charset=["']?[^>]+>/i, '<meta charset="utf-8">');
    head = replaceOrInsert(head, /<meta\s+name=["']viewport["'][^>]*>/i, '<meta name="viewport" content="width=device-width,initial-scale=1">');
    head = replaceOrInsert(head, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`);
    head = replaceOrInsert(head, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeAttr(seo.description)}">`);
    head = replaceOrInsert(head, /<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">');
    head = replaceOrInsert(head, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}">`);
    head = replaceOrInsert(head, /<meta\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="website">');
    head = replaceOrInsert(head, /<meta\s+property=["']og:site_name["'][^>]*>/i, `<meta property="og:site_name" content="${escapeAttr(site.name)}">`);
    head = replaceOrInsert(head, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeAttr(seo.title)}">`);
    head = replaceOrInsert(head, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeAttr(seo.description)}">`);
    head = replaceOrInsert(head, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}">`);
    head = replaceOrInsert(head, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeAttr(logo)}">`);
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:card["'][^>]*>/i, '<meta name="twitter:card" content="summary_large_image">');
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeAttr(seo.title)}">`);
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeAttr(seo.description)}">`);
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeAttr(logo)}">`);
    head += `\n<link rel="icon" href="${escapeAttr(logo)}">`;
    head += `\n<link rel="apple-touch-icon" href="${escapeAttr(logo)}">`;
    head += `\n<link rel="manifest" href="${escapeAttr(manifestUrl)}">`;
    head += `\n<meta name="theme-color" content="#ffffff">`;
    head += `\n<meta name="mobile-web-app-capable" content="yes">`;
    head += `\n<meta name="apple-mobile-web-app-capable" content="yes">`;
    head += `\n<meta name="apple-mobile-web-app-title" content="${escapeAttr(String(site.name || '').slice(0,32))}">`;
    head += `\n<script type="application/ld+json" data-quartz-seo="true">${schemaText}</script>`;
    return `<head${attrs}>${head}</head>`;
  });

  const register = `<script data-quartz-pwa="true">if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register(${JSON.stringify(swUrl)},{scope:${JSON.stringify(`/${site.slug}/`)}}).catch(()=>{}));}</script>`;
  if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${register}</body>`);
  else out += register;
  return out;
}
function escapeHtml(s) { return String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function escapeAttr(s) { return String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }

async function getR2Object(env, siteId, candidate) {
  if (!env.SITES_BUCKET || candidate.includes('..')) return null;
  return env.SITES_BUCKET.get(`sites/${siteId}/${candidate}`);
}
async function serveConnected(request, env, url) {
  if (!env.DB) return null;
  await ensureSchema(env);
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return null;
  const slug = normalizeSlug(parts[0]);
  const site = await env.DB.prepare(`SELECT * FROM connected_sites WHERE slug=? AND status='published'`).bind(slug).first();
  if (!site) return null;
  const rest = parts.slice(1).join('/');

  if (rest === 'manifest.webmanifest') return connectedManifest(site);
  if (rest === 'sw.js') return connectedServiceWorker(site);
  if (rest === 'favicon.ico') return Response.redirect(siteLogoUrl(site), 302);

  if (!rest || /^index\.html?$/i.test(rest)) {
    const canonical = `${BASE_URL}/${site.slug}/`;
    if (url.pathname !== `/${site.slug}/`) return Response.redirect(canonical + url.search, 301);
    const rendered = injectSeo(site, site.index_html, canonical);
    return new Response(rendered, { headers:{ 'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60, must-revalidate','x-quartz-site':site.slug } });
  }
  if (!env.SITES_BUCKET) return new Response('Site asset storage is not configured', { status:503 });

  const candidates = [rest];
  if (!rest.includes('.')) candidates.push(rest.replace(/\/$/,'') + '/index.html', rest.replace(/\/$/,'') + '.html');
  for (const candidate of candidates) {
    const obj = await getR2Object(env, site.id, candidate);
    if (!obj) continue;
    const type = obj.httpMetadata?.contentType || guessType(candidate);
    if (type.includes('text/html')) {
      const canonicalPath = canonicalPathForAsset(site.slug,candidate);
      const canonical = BASE_URL + canonicalPath;
      if (url.pathname !== canonicalPath) return Response.redirect(canonical + url.search, 301);
      const text = await obj.text();
      return new Response(injectSeo(site,text,canonical), { headers:{ 'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60, must-revalidate','x-quartz-site':site.slug } });
    }
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    // Connected-site assets are editable. Do not mark them immutable for a year.
    headers.set('cache-control','public, max-age=300, must-revalidate');
    return new Response(obj.body,{headers});
  }
  return new Response('Not found',{status:404,headers:{'x-robots-tag':'noindex'}});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const isAdminHost = url.hostname === 'admin.quartzwebsolutions.com';
      const isMainHost = url.hostname === 'quartzwebsolutions.com' || url.hostname === 'www.quartzwebsolutions.com';

      if (url.hostname === 'www.quartzwebsolutions.com') {
        const canonicalUrl = new URL(request.url); canonicalUrl.hostname = 'quartzwebsolutions.com';
        return Response.redirect(canonicalUrl.toString(),301);
      }
      if (url.pathname.startsWith('/api/')) return await handleAdminApi(request,env,url);
      if (isMainHost && url.pathname.startsWith('/admin')) return Response.redirect(`${ADMIN_URL}/`,302);

      if (isAdminHost && url.pathname === '/') {
        const adminUrl = new URL(request.url); adminUrl.pathname = '/admin/';
        const res = await env.ASSETS.fetch(new Request(adminUrl,request));
        const h = new Headers(res.headers); h.set('x-robots-tag','noindex,nofollow,noarchive'); h.set('cache-control','no-store');
        return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
      }
      if (isAdminHost) {
        const res = await env.ASSETS.fetch(request);
        const h = new Headers(res.headers); h.set('x-robots-tag','noindex,nofollow,noarchive');
        return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
      }

      if (isMainHost && url.pathname === '/sitemap.xml') return await sitemap(env);
      if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);

      const staticResponse = await env.ASSETS.fetch(request);
      if (staticResponse.status !== 404) return staticResponse;
      if (isMainHost) {
        const connected = await serveConnected(request,env,url);
        if (connected) return connected;
      }
      return staticResponse;
    } catch (e) {
      if (url.pathname.startsWith('/api/')) return bad(String(e?.message||e),500);
      return new Response('Quartz platform error',{status:500,headers:{'x-robots-tag':'noindex'}});
    }
  }
};
