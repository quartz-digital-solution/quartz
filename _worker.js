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
  '/locations/calicut/',
  '/businesses/'
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
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS connected_sites (
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
      business_description TEXT DEFAULT '',
      services_json TEXT DEFAULT '[]',
      index_html TEXT NOT NULL DEFAULT '<!doctype html><html><head><title>New Website</title></head><body></body></html>',
      deployed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_connected_sites_slug ON connected_sites(slug);
    CREATE INDEX IF NOT EXISTS idx_connected_sites_status ON connected_sites(status);
  `);

  // Safe automatic migration for databases created by earlier Quartz builds.
  const info = await env.DB.prepare('PRAGMA table_info(connected_sites)').all();
  const existing = new Set((info.results || []).map(r => r.name));
  const migrations = [
    ['business_type', `TEXT DEFAULT 'LocalBusiness'`],
    ['country_code', `TEXT DEFAULT 'IN'`],
    ['postal_code', `TEXT DEFAULT ''`],
    ['email', `TEXT DEFAULT ''`],
    ['opening_hours_json', `TEXT DEFAULT '[]'`]
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

const SITE_COLUMNS = `slug,name,status,logo_path,seo_title,seo_description,primary_keyword,keywords_json,category,business_type,city,district,state,country_code,address,postal_code,phone,whatsapp,email,opening_hours_json,business_description,services_json,index_html,deployed_at,created_at,updated_at`;

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
      const values = [s.slug,s.name,s.status,s.logo_path,s.seo_title,s.seo_description,s.primary_keyword,s.keywords_json,s.category,s.business_type,s.city,s.district,s.state,s.country_code,s.address,s.postal_code,s.phone,s.whatsapp,s.email,s.opening_hours_json,s.business_description,s.services_json,s.index_html,s.status==='published'?now:null,now,now];
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
        const row = await env.DB.prepare(`UPDATE connected_sites SET slug=?,name=?,status=?,logo_path=?,seo_title=?,seo_description=?,primary_keyword=?,keywords_json=?,category=?,business_type=?,city=?,district=?,state=?,country_code=?,address=?,postal_code=?,phone=?,whatsapp=?,email=?,opening_hours_json=?,business_description=?,services_json=?,index_html=?,deployed_at=?,updated_at=? WHERE id=? RETURNING *`)
          .bind(s.slug,s.name,s.status,s.logo_path,s.seo_title,s.seo_description,s.primary_keyword,s.keywords_json,s.category,s.business_type,s.city,s.district,s.state,s.country_code,s.address,s.postal_code,s.phone,s.whatsapp,s.email,s.opening_hours_json,s.business_description,s.services_json,s.index_html,deployed,now,id).first();
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
      const r = await env.DB.prepare(`SELECT id,slug,name,logo_path,city,updated_at FROM connected_sites WHERE status='published' ORDER BY updated_at DESC`).all();
      sites = r.results || [];
    } catch {}
  }
  const urls = STATIC_SITEMAP_PATHS.map(path => ({ loc:`${BASE_URL}${path}`, lastmod:'', image:'' }));

  const cityDates = new Map();
  for (const site of sites) {
    const siteLogo = site.logo_path ? `${BASE_URL}/${site.slug}/${site.logo_path.replace(/^\/+/, '')}` : '';
    urls.push({ loc:`${BASE_URL}/${site.slug}/`, lastmod:dateOnly(site.updated_at), image:siteLogo });
    if (site.city) {
      const citySlug = normalizeSlug(site.city);
      if (citySlug) {
        const prev = cityDates.get(citySlug);
        const next = laterDate(prev, site.updated_at);
        cityDates.set(citySlug, next);
      }
    }
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
    for (const [route, lm] of seen) urls.push({ loc:`${BASE_URL}/${site.slug}/${route}`, lastmod:dateOnly(lm), image:'' });
  }
  for (const [citySlug, lm] of cityDates) {
    urls.push({ loc:`${BASE_URL}/businesses/city/${citySlug}/`, lastmod:dateOnly(lm), image:'' });
  }

  const unique = new Map();
  for (const u of urls) unique.set(u.loc, u);
  const rows = [...unique.values()].map(u => `<url><loc>${escapeXml(u.loc)}</loc>${u.lastmod?`<lastmod>${escapeXml(u.lastmod)}</lastmod>`:''}${u.image?`<image:image><image:loc>${escapeXml(u.image)}</image:loc></image:image>`:''}</url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${rows.join('\n')}\n</urlset>`;
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
function generatedSearchPhrases(site) {
  const manual = (()=>{try{return JSON.parse(site.keywords_json||'[]')}catch{return[]}})();
  const services = (()=>{try{return JSON.parse(site.services_json||'[]')}catch{return[]}})();
  const out = new Set();
  const add = v => { const x=String(v||'').replace(/\s+/g,' ').trim(); if (x) out.add(x); };
  const name=String(site.name||'').trim(), category=String(site.category||'').trim(), city=String(site.city||'').trim(), district=String(site.district||'').trim(), state=String(site.state||'').trim();
  const simpleCategory = category.replace(/\b(store|shop|business|services?|company|centre|center)\b/gi,'').replace(/\s+/g,' ').trim();
  add(site.primary_keyword); manual.forEach(add); add(name); add(category);
  if (name && city) { add(`${name} ${city}`); add(`${name} in ${city}`); }
  if (name && district) add(`${name} ${district}`);
  if (name && category) add(`${name} ${category}`);
  if (name && category && city) add(`${name} ${category} ${city}`);
  if (category && city) { add(`${category} ${city}`); add(`${category} in ${city}`); }
  if (simpleCategory && city) { add(`${simpleCategory} ${city}`); add(`${city} ${simpleCategory}`); }
  if (category && district) add(`${category} ${district}`);
  if (category && state) add(`${category} ${state}`);
  services.slice(0,20).forEach(service => { add(service); if(city){add(`${service} ${city}`); add(`${service} in ${city}`);} if(name)add(`${name} ${service}`); });
  return [...out].slice(0,80);
}
function extractMetaProperty(html, property) {
  const p=String(property||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const a=String(html||'').match(new RegExp(`<meta\\s+[^>]*property=["']${p}["'][^>]*content=["']([^"']*)["'][^>]*>`,'i'));
  const b=String(html||'').match(new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*property=["']${p}["'][^>]*>`,'i'));
  return (a||b||[])[1]||'';
}
function firstImageSrc(html) {
  const m=String(html||'').match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  return m ? m[1].trim() : '';
}
function absolutePageAsset(src, canonical) {
  const v=String(src||'').trim();
  if(!v || /^(data:|blob:|javascript:)/i.test(v)) return '';
  try { return new URL(v, canonical).toString(); } catch { return ''; }
}
function pageImage(site, htmlText, canonical) {
  if (site.logo_path) return `${BASE_URL}/${site.slug}/${site.logo_path.replace(/^\/+/, '')}`;
  return absolutePageAsset(extractMetaProperty(htmlText,'og:image') || firstImageSrc(htmlText), canonical);
}
function imageAltFromSrc(src, site) {
  const base=humanizeSegment(String(src||'').split('/').pop().split('?')[0].replace(/\.[a-z0-9]{2,8}$/i,''));
  const context=[site.name, site.category, site.city].filter(Boolean).join(' ');
  if (!base || /^(img|image|photo|pic|hero|banner|cover|logo|icon)$/i.test(base)) return context || site.name || 'Business image';
  return `${base} – ${context || site.name}`.slice(0,180);
}
function enhanceImageSeo(htmlText, site) {
  return String(htmlText||'').replace(/<img\b([^>]*)>/gi, (whole, attrs) => {
    if (/\balt\s*=\s*(["'])/i.test(attrs)) return whole;
    const src=(attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)||[])[2]||'';
    if (!src) return whole;
    const alt=escapeAttr(imageAltFromSrc(src,site));
    return `<img${attrs} alt="${alt}">`;
  });
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
  const businessDescriptor = site.category || 'Business';
  const location = [site.city, site.district].filter(Boolean).join(', ');

  let title;
  if (isRoot) title = site.seo_title || `${site.name}${businessDescriptor ? ` | ${businessDescriptor}` : ''}${site.city ? ` in ${site.city}` : ''}`;
  else if (originalTitle && !genericTitles.has(originalTitle.toLowerCase())) title = originalTitle.toLowerCase().includes(String(site.name).toLowerCase()) ? originalTitle : `${originalTitle} | ${site.name}`;
  else title = `${pageLabel || 'Business'} | ${site.name}${site.city ? ` ${site.city}` : ''}`;

  let description;
  if (isRoot) description = site.seo_description || site.business_description || `${site.name} is a ${businessDescriptor}${location?` in ${location}`:''}. Explore products or services, location, opening hours and contact details.`;
  else description = originalDesc || `${pageLabel || 'Information'} from ${site.name}${location?` in ${location}`:''}. ${site.business_description || `View business details, services and contact information.`}`;
  description = stripTags(description).slice(0, 220);
  return { title:title.slice(0,100), description, isRoot, pageLabel, rootCanonical, segments, searchPhrases:generatedSearchPhrases(site) };
}

function schemaGraph(site, seo, canonical, image, logo) {
  const services = (()=>{try{return JSON.parse(site.services_json||'[]')}catch{return[]}})();
  const openingHours = (()=>{try{return JSON.parse(site.opening_hours_json||'[]')}catch{return[]}})();
  const hasAddress = site.address || site.city || site.district || site.postal_code;
  const business = {
    '@type': normalizeBusinessType(site.business_type),
    '@id': seo.rootCanonical + '#business',
    name: site.name,
    url: seo.rootCanonical,
    image: image || undefined,
    logo: logo || undefined,
    description: site.business_description || seo.description,
    telephone: site.phone || undefined,
    email: site.email || undefined,
    openingHours: openingHours.length ? openingHours : undefined,
    address: hasAddress ? {
      '@type':'PostalAddress',
      streetAddress:site.address||undefined,
      addressLocality:site.city||undefined,
      addressRegion:site.state||site.district||'Kerala',
      postalCode:site.postal_code||undefined,
      addressCountry:site.country_code||'IN'
    } : undefined,
    areaServed:[site.city,site.district,site.state].filter(Boolean),
    knowsAbout:seo.searchPhrases.slice(0,40),
    hasOfferCatalog: services.length ? {
      '@type':'OfferCatalog',
      name:`${site.name} products and services`,
      itemListElement:services.slice(0,30).map(name=>({'@type':'Offer','itemOffered':{'@type':'Service','name':name}}))
    } : undefined
  };
  const breadcrumbs = [
    {'@type':'ListItem',position:1,name:site.name,item:seo.rootCanonical}
  ];
  let builtPath = `/${site.slug}/`;
  seo.segments.forEach((seg,i)=>{
    const isFile = i === seo.segments.length - 1 && /\.[a-z0-9]{1,8}$/i.test(seg);
    builtPath += `${encodeURIComponent(seg)}${isFile?'':'/'}`;
    breadcrumbs.push({'@type':'ListItem',position:i+2,name:humanizeSegment(seg),item:BASE_URL+builtPath});
  });
  const graph=[
    business,
    {
      '@type':'WebSite','@id':seo.rootCanonical+'#website',url:seo.rootCanonical,name:site.name,inLanguage:'en-IN',publisher:{'@id':seo.rootCanonical+'#business'}
    },
    {
      '@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:seo.title,description:seo.description,inLanguage:'en-IN',
      isPartOf:{'@id':seo.rootCanonical+'#website'},
      about:{'@id':seo.rootCanonical+'#business'},
      mainEntity:seo.isRoot?{'@id':seo.rootCanonical+'#business'}:undefined,
      keywords:seo.searchPhrases.join(', ') || undefined,
      primaryImageOfPage:image?{'@id':canonical+'#primaryimage'}:undefined,
      breadcrumb:{'@id':canonical+'#breadcrumb'}
    },
    {'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:breadcrumbs}
  ];
  if(image) graph.push({'@type':'ImageObject','@id':canonical+'#primaryimage',url:image,contentUrl:image,caption:`${site.name}${site.city?` in ${site.city}`:''}`});
  return {'@context':'https://schema.org','@graph':graph};
}

function injectSeo(site, htmlText, canonical) {
  let out = htmlText || '<!doctype html><html><head></head><body></body></html>';
  out = rewriteRootRelative(out, site.slug);
  out = enhanceImageSeo(out, site);
  const seo = pageSeo(site, out, canonical);
  const logo = site.logo_path ? `${BASE_URL}/${site.slug}/${site.logo_path.replace(/^\/+/, '')}` : '';
  const image = pageImage(site, out, canonical);
  const schemaText = JSON.stringify(schemaGraph(site,seo,canonical,image,logo)).replace(/<\//g,'<\\/');
  if (!/<html[\s>]/i.test(out)) out = `<!doctype html><html lang="en-IN"><head></head><body>${out}</body></html>`;
  else if (!/<html[^>]*\slang=/i.test(out)) out = out.replace(/<html([^>]*)>/i,'<html$1 lang="en-IN">');
  if (!/<head[\s>]/i.test(out)) out = out.replace(/<html[^>]*>/i, m => `${m}<head></head>`);

  out = out.replace(/<head([^>]*)>([\s\S]*?)<\/head>/i, (whole, attrs, head) => {
    // Meta keywords are intentionally removed. Google does not use them.
    head = head.replace(/<meta\s+[^>]*name=["']keywords["'][^>]*>\s*/gi,'');
    head = head.replace(/<script[^>]+data-quartz-seo=["']true["'][^>]*>[\s\S]*?<\/script>\s*/gi,'');
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
    if(image){
      head = replaceOrInsert(head, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeAttr(image)}">`);
      head = replaceOrInsert(head, /<meta\s+property=["']og:image:alt["'][^>]*>/i, `<meta property="og:image:alt" content="${escapeAttr(`${site.name}${site.city?` in ${site.city}`:''}`)}">`);
    }
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:card["'][^>]*>/i, image?'<meta name="twitter:card" content="summary_large_image">':'<meta name="twitter:card" content="summary">');
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeAttr(seo.title)}">`);
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeAttr(seo.description)}">`);
    if(image){
      head = replaceOrInsert(head, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeAttr(image)}">`);
      head = replaceOrInsert(head, /<meta\s+name=["']twitter:image:alt["'][^>]*>/i, `<meta name="twitter:image:alt" content="${escapeAttr(`${site.name}${site.city?` in ${site.city}`:''}`)}">`);
    }
    head += `\n<script type="application/ld+json" data-quartz-seo="true">${schemaText}</script>`;
    return `<head${attrs}>${head}</head>`;
  });
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

async function businessDirectory(env, url) {
  if (url.pathname === '/businesses') return Response.redirect(`${BASE_URL}/businesses/`,301);
  if (!env.DB) return new Response('Business directory is not configured',{status:503,headers:{'x-robots-tag':'noindex'}});
  await ensureSchema(env);
  const cityMatch=url.pathname.match(/^\/businesses\/city\/([^/]+)\/?$/i);
  const citySlug=cityMatch ? normalizeSlug(cityMatch[1]) : '';
  const result=await env.DB.prepare(`SELECT slug,name,category,city,district,state,business_description,logo_path,updated_at FROM connected_sites WHERE status='published' ORDER BY name COLLATE NOCASE`).all();
  let sites=result.results||[];
  let cityLabel='';
  if(citySlug){
    sites=sites.filter(x=>normalizeSlug(x.city)===citySlug);
    cityLabel=sites[0]?.city || humanizeSegment(citySlug);
    if(!sites.length) return new Response('Not found',{status:404,headers:{'x-robots-tag':'noindex'}});
  }
  const canonical=citySlug?`${BASE_URL}/businesses/city/${citySlug}/`:`${BASE_URL}/businesses/`;
  const title=citySlug?`Businesses in ${cityLabel} | Local Business Websites`:`Local Business Websites Directory | Quartz Web Solutions`;
  const description=citySlug?`Explore published local business websites in ${cityLabel}, including shops and service businesses with direct contact and location details.`:`Explore published local business websites hosted by Quartz Web Solutions. Browse shops and service businesses by name and location.`;
  const cards=sites.map(site=>{
    const logo=site.logo_path?`${BASE_URL}/${site.slug}/${site.logo_path.replace(/^\/+/, '')}`:'';
    const loc=[site.city,site.district].filter(Boolean).join(', ');
    return `<article class="directory-card">${logo?`<img src="${escapeAttr(logo)}" alt="${escapeAttr(site.name)} logo" loading="lazy" decoding="async">`:''}<div><h2><a href="/${encodeURIComponent(site.slug)}/">${escapeHtml(site.name)}</a></h2><p class="directory-meta">${escapeHtml([site.category,loc].filter(Boolean).join(' · '))}</p><p>${escapeHtml((site.business_description||`Visit ${site.name} for business details, products or services and contact information.`).slice(0,240))}</p><a class="directory-link" href="/${encodeURIComponent(site.slug)}/">Open ${escapeHtml(site.name)} →</a></div></article>`;
  }).join('');
  const itemList=sites.map((site,i)=>({'@type':'ListItem',position:i+1,url:`${BASE_URL}/${site.slug}/`,name:site.name}));
  const schema=JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'CollectionPage','url':canonical,'name':title,'description':description,'inLanguage':'en-IN'},{'@type':'ItemList','itemListElement':itemList}]}).replace(/<\//g,'<\\/');
  const html=`<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow,max-image-preview:large"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeAttr(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" type="image/png" sizes="32x32" href="/asset/img/fav/favicon-32.png"><meta name="theme-color" content="#050505"><script type="application/ld+json">${schema}</script><style>body{margin:0;background:#050505;color:#f5f5f5;font-family:Arial,sans-serif}.wrap{width:min(1080px,calc(100% - 32px));margin:auto;padding:56px 0}.back{color:#ff3048;text-decoration:none}.head{margin:30px 0}.head h1{font-size:clamp(32px,7vw,64px);line-height:1;margin:0 0 14px}.head p{color:#aaa;max-width:760px;line-height:1.7}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.directory-card{display:flex;gap:16px;border:1px solid #252525;border-radius:18px;padding:20px;background:#0b0b0c}.directory-card img{width:68px;height:68px;object-fit:contain;border-radius:14px;background:#000}.directory-card h2{margin:0 0 7px;font-size:20px}.directory-card h2 a,.directory-link{color:#fff;text-decoration:none}.directory-link{color:#ff3048;font-weight:700}.directory-card p{color:#aaa;line-height:1.55}.directory-meta{font-size:13px;color:#ddd!important}.cities{margin:26px 0;display:flex;flex-wrap:wrap;gap:8px}.cities a{color:#ddd;border:1px solid #333;padding:8px 12px;border-radius:999px;text-decoration:none}</style></head><body><main class="wrap"><a class="back" href="/">← Quartz Web Solutions</a><header class="head"><h1>${escapeHtml(citySlug?`Businesses in ${cityLabel}`:'Local business websites')}</h1><p>${escapeHtml(description)}</p></header>${!citySlug?`<nav class="cities">${[...new Set((result.results||[]).map(x=>x.city).filter(Boolean))].sort().map(c=>`<a href="/businesses/city/${normalizeSlug(c)}/">${escapeHtml(c)}</a>`).join('')}</nav>`:''}<section class="grid">${cards||'<p>No published businesses yet.</p>'}</section></main></body></html>`;
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60, must-revalidate'}});
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
      if (isMainHost && (url.pathname === '/businesses' || url.pathname === '/businesses/' || /^\/businesses\/city\/[^/]+\/?$/i.test(url.pathname))) return await businessDirectory(env,url);
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
