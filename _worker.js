const enc = new TextEncoder();
const dec = new TextDecoder();
const BASE_URL = 'https://quartzwebsolutions.com';
const ADMIN_URL = 'https://admin.quartzwebsolutions.com';
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
  } catch {
    return false;
  }
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
      city TEXT DEFAULT '',
      district TEXT DEFAULT '',
      state TEXT DEFAULT 'Kerala',
      address TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
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
}

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value || '').split(/[\n,]+/).map(v => v.trim()).filter(Boolean);
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
    city: String(body.city || '').trim().slice(0, 120),
    district: String(body.district || '').trim().slice(0, 120),
    state: String(body.state || 'Kerala').trim().slice(0, 120),
    address: String(body.address || '').trim().slice(0, 500),
    phone: String(body.phone || '').trim().slice(0, 60),
    whatsapp: String(body.whatsapp || '').trim().slice(0, 60),
    business_description: String(body.business_description || '').trim().slice(0, 2000),
    services_json: JSON.stringify(parseList(body.services).slice(0, 50)),
    index_html: String(body.index_html || '').slice(0, 2_000_000)
  };
}

function rowToSite(row) {
  if (!row) return null;
  return {
    ...row,
    keywords: (() => { try { return JSON.parse(row.keywords_json || '[]'); } catch { return []; } })(),
    services: (() => { try { return JSON.parse(row.services_json || '[]'); } catch { return []; } })()
  };
}

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
    return json({ ok: true }, 200, {
      'set-cookie': `quartz_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`
    });
  }

  if (pathname === '/api/admin/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, {
      'set-cookie': 'quartz_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
    });
  }

  if (!(await isAdmin(request, env))) return bad('Unauthorized', 401);

  if (pathname === '/api/admin/me') return json({ ok: true, loginId: env.ADMIN_LOGIN_ID || 'quartex' });

  await ensureSchema(env);

  if (pathname === '/api/sites' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    let result;
    if (q) {
      result = await env.DB.prepare(`SELECT id,slug,name,status,logo_path,seo_title,primary_keyword,category,city,district,deployed_at,created_at,updated_at FROM connected_sites WHERE name LIKE ? OR slug LIKE ? OR primary_keyword LIKE ? ORDER BY updated_at DESC`).bind(`%${q}%`, `%${q}%`, `%${q}%`).all();
    } else {
      result = await env.DB.prepare(`SELECT id,slug,name,status,logo_path,seo_title,primary_keyword,category,city,district,deployed_at,created_at,updated_at FROM connected_sites ORDER BY updated_at DESC`).all();
    }
    return json({ ok: true, sites: result.results || [] });
  }

  if (pathname === '/api/sites' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const s = sanitizeSiteInput(body);
    if (!s.name || !s.slug || !s.index_html) return bad('Name, URL slug and index.html are required');
    const now = new Date().toISOString();
    try {
      const r = await env.DB.prepare(`INSERT INTO connected_sites (slug,name,status,logo_path,seo_title,seo_description,primary_keyword,keywords_json,category,city,district,state,address,phone,whatsapp,business_description,services_json,index_html,deployed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`)
        .bind(s.slug,s.name,s.status,s.logo_path,s.seo_title,s.seo_description,s.primary_keyword,s.keywords_json,s.category,s.city,s.district,s.state,s.address,s.phone,s.whatsapp,s.business_description,s.services_json,s.index_html,s.status==='published'?now:null,now,now).first();
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
        const row = await env.DB.prepare(`UPDATE connected_sites SET slug=?,name=?,status=?,logo_path=?,seo_title=?,seo_description=?,primary_keyword=?,keywords_json=?,category=?,city=?,district=?,state=?,address=?,phone=?,whatsapp=?,business_description=?,services_json=?,index_html=?,deployed_at=?,updated_at=? WHERE id=? RETURNING *`)
          .bind(s.slug,s.name,s.status,s.logo_path,s.seo_title,s.seo_description,s.primary_keyword,s.keywords_json,s.category,s.city,s.district,s.state,s.address,s.phone,s.whatsapp,s.business_description,s.services_json,s.index_html,deployed,now,id).first();
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
      const result = await env.SITES_BUCKET.list({ prefix: `sites/${id}/`, limit: 1000 });
      return json({ ok: true, assets: result.objects.map(o => ({ path: o.key.slice(`sites/${id}/`.length), size: o.size, uploaded: o.uploaded })) });
    }
    const rawPath = decodeURIComponent(url.searchParams.get('path') || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rawPath || rawPath.includes('..')) return bad('Invalid asset path');
    const key = `sites/${id}/${rawPath}`;
    if (request.method === 'PUT') {
      const type = request.headers.get('content-type') || guessType(rawPath);
      await env.SITES_BUCKET.put(key, request.body, { httpMetadata: { contentType: type } });
      return json({ ok: true, path: rawPath, url: `${BASE_URL}/${site.slug}/${rawPath}` });
    }
    if (request.method === 'DELETE') {
      await env.SITES_BUCKET.delete(key);
      return json({ ok: true });
    }
  }

  return bad('API route not found', 404);
}

function escapeXml(value) {
  return String(value).replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','\"':'&quot;'}[c]));
}

async function sitemap(env) {
  let sites = [];
  if (env.DB) {
    try {
      await ensureSchema(env);
      const r = await env.DB.prepare(`SELECT slug,updated_at FROM connected_sites WHERE status='published' ORDER BY updated_at DESC`).all();
      sites = r.results || [];
    } catch {}
  }
  const today = new Date().toISOString().slice(0, 10);
  const staticUrls = STATIC_SITEMAP_PATHS.map(path => `<url><loc>${BASE_URL}${path}</loc><lastmod>${today}</lastmod></url>`);
  const dynamicUrls = sites.map(s => `<url><loc>${BASE_URL}/${escapeXml(s.slug)}/</loc><lastmod>${escapeXml(String(s.updated_at || today).slice(0,10))}</lastmod></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls,...dynamicUrls].join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' } });
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

function injectSeo(site, htmlText, currentUrl) {
  const title = site.seo_title || `${site.name}${site.city ? ` | ${site.category || 'Business'} in ${site.city}` : ''}`;
  const description = site.seo_description || site.business_description || `${site.name}${site.city ? ` in ${site.city}` : ''}${site.district ? `, ${site.district}` : ''}. View business details, services and contact information.`;
  const canonical = `${BASE_URL}/${site.slug}/`;
  const logo = site.logo_path ? `${BASE_URL}/${site.slug}/${site.logo_path.replace(/^\/+/, '')}` : `${BASE_URL}/asset/img/og/quartz-web-solutions-og.png`;
  const keywords = (() => { try { return JSON.parse(site.keywords_json || '[]'); } catch { return []; } })();
  const services = (() => { try { return JSON.parse(site.services_json || '[]'); } catch { return []; } })();
  const schema = {
    '@context':'https://schema.org',
    '@graph':[
      {
        '@type':'LocalBusiness',
        '@id': canonical + '#business',
        name: site.name,
        url: canonical,
        image: logo,
        description,
        telephone: site.phone || undefined,
        address: site.address || site.city || site.district ? {
          '@type':'PostalAddress',
          streetAddress: site.address || undefined,
          addressLocality: site.city || undefined,
          addressRegion: site.state || site.district || 'Kerala',
          addressCountry:'IN'
        } : undefined,
        areaServed: [site.city, site.district, site.state].filter(Boolean),
        knowsAbout: [...new Set([site.primary_keyword, ...keywords, ...services].filter(Boolean))].slice(0, 30)
      },
      {
        '@type':'WebPage',
        '@id': canonical + '#webpage',
        url: canonical,
        name: title,
        description,
        inLanguage:'en-IN',
        about:{'@id':canonical+'#business'},
        keywords:[site.primary_keyword, ...keywords].filter(Boolean)
      },
      {
        '@type':'BreadcrumbList',
        itemListElement:[
          {'@type':'ListItem',position:1,name:'Quartz Web Solutions',item:BASE_URL+'/'},
          {'@type':'ListItem',position:2,name:site.name,item:canonical}
        ]
      }
    ]
  };
  const cleaned = JSON.parse(JSON.stringify(schema));
  const schemaText = JSON.stringify(cleaned).replace(/<\//g, '<\\/');
  let out = htmlText || '<!doctype html><html><head></head><body></body></html>';
  out = rewriteRootRelative(out, site.slug);
  if (!/<head[\s>]/i.test(out)) out = out.replace(/<html[^>]*>/i, m => `${m}<head></head>`);
  out = out.replace(/<head([^>]*)>([\s\S]*?)<\/head>/i, (whole, attrs, head) => {
    head = replaceOrInsert(head, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    head = replaceOrInsert(head, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeAttr(description)}">`);
    head = replaceOrInsert(head, /<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">');
    head = replaceOrInsert(head, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}">`);
    head = replaceOrInsert(head, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeAttr(title)}">`);
    head = replaceOrInsert(head, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeAttr(description)}">`);
    head = replaceOrInsert(head, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}">`);
    head = replaceOrInsert(head, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeAttr(logo)}">`);
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:card["'][^>]*>/i, '<meta name="twitter:card" content="summary_large_image">');
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeAttr(title)}">`);
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeAttr(description)}">`);
    head = replaceOrInsert(head, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeAttr(logo)}">`);
    // Meta keywords are retained only for compatibility; Google does not use them for ranking.
    if (keywords.length || site.primary_keyword) {
      head = replaceOrInsert(head, /<meta\s+name=["']keywords["'][^>]*>/i, `<meta name="keywords" content="${escapeAttr([site.primary_keyword,...keywords].filter(Boolean).join(', '))}">`);
    }
    head = head.replace(/<script[^>]+data-quartz-seo=["']true["'][^>]*>[\s\S]*?<\/script>/gi, '');
    head += `\n<script type="application/ld+json" data-quartz-seo="true">${schemaText}</script>`;
    return `<head${attrs}>${head}</head>`;
  });
  return out;
}

function escapeHtml(s) { return String(s || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function escapeAttr(s) { return String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }

async function serveConnected(request, env, url) {
  if (!env.DB) return null;
  await ensureSchema(env);
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return null;
  const slug = normalizeSlug(parts[0]);
  const site = await env.DB.prepare(`SELECT * FROM connected_sites WHERE slug=? AND status='published'`).bind(slug).first();
  if (!site) return null;
  const rest = parts.slice(1).join('/');
  if (!rest || rest === 'index.html') {
    const rendered = injectSeo(site, site.index_html, url.href);
    return new Response(rendered, { headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'public, max-age=300', 'x-quartz-site': site.slug } });
  }
  if (!env.SITES_BUCKET) return new Response('Site asset storage is not configured', { status: 503 });
  const candidates = [rest];
  if (!rest.includes('.')) candidates.push(rest.replace(/\/$/,'') + '/index.html', rest + '.html');
  for (const candidate of candidates) {
    if (candidate.includes('..')) continue;
    const obj = await env.SITES_BUCKET.get(`sites/${site.id}/${candidate}`);
    if (!obj) continue;
    const type = obj.httpMetadata?.contentType || guessType(candidate);
    if (type.includes('text/html')) {
      const text = await obj.text();
      return new Response(injectSeo(site, text, url.href), { headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'public, max-age=300', 'x-quartz-site': site.slug } });
    }
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(obj.body, { headers });
  }
  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const isAdminHost = url.hostname === 'admin.quartzwebsolutions.com';
      const isMainHost = url.hostname === 'quartzwebsolutions.com' || url.hostname === 'www.quartzwebsolutions.com';

      if (url.hostname === 'www.quartzwebsolutions.com') {
        const canonicalUrl = new URL(request.url); canonicalUrl.hostname = 'quartzwebsolutions.com';
        return Response.redirect(canonicalUrl.toString(), 301);
      }

      if (url.pathname.startsWith('/api/')) return await handleAdminApi(request, env, url);

      if (isMainHost && url.pathname.startsWith('/admin')) {
        return Response.redirect(`${ADMIN_URL}/`, 302);
      }

      if (isAdminHost && url.pathname === '/') {
        const adminUrl = new URL(request.url); adminUrl.pathname = '/admin/';
        return env.ASSETS.fetch(new Request(adminUrl, request));
      }

      if (isMainHost && url.pathname === '/sitemap.xml') return await sitemap(env);
      if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);

      const staticResponse = await env.ASSETS.fetch(request);
      if (staticResponse.status !== 404) return staticResponse;

      if (isMainHost) {
        const connected = await serveConnected(request, env, url);
        if (connected) return connected;
      }
      return staticResponse;
    } catch (e) {
      if (url.pathname.startsWith('/api/')) return bad(String(e?.message || e), 500);
      return new Response('Quartz platform error', { status: 500 });
    }
  }
};
