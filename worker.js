/**
 * ps.chom.ps — Cloudflare Worker
 *
 * Dynamic rendering from KV. Static assets (CSS, favicons, /admin/)
 * are served automatically by Workers Assets from public/.
 *
 * KV structure:
 *   posts-index   → JSON array of post metadata, sorted newest-first
 *   post:{slug}   → Full post JSON (includes contentHtml)
 */

import { marked } from 'marked';

const BASE   = 'https://ps.chom.ps';
const TITLE  = '.ps';
const DESC   = 'An archive of zen baking and chomp theory';

// ── Helpers ────────────────────────────────────────────────

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatRssDate(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').toUTCString();
}

function wordCount(markdown) {
  return markdown.replace(/[#*`_[\]()>~]/g, ' ').split(/\s+/).filter(Boolean).length;
}

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlResp(status, body, extra = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache', ...extra },
  });
}

function jsonResp(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function checkAuth(request, env) {
  const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return auth.length > 0 && auth === (env.ADMIN_TOKEN || '');
}

// ── KV helpers ─────────────────────────────────────────────

async function getIndex(env) {
  const raw = await env.POSTS.get('posts-index');
  return raw ? JSON.parse(raw) : [];
}

async function putIndex(env, index) {
  await env.POSTS.put('posts-index', JSON.stringify(index));
}

async function getPost(env, slug) {
  const raw = await env.POSTS.get(`post:${slug}`);
  return raw ? JSON.parse(raw) : null;
}

async function putPost(env, slug, post) {
  await env.POSTS.put(`post:${slug}`, JSON.stringify(post));
}

async function kvDeletePost(env, slug) {
  await env.POSTS.delete(`post:${slug}`);
}

// ── Shared HTML fragments ──────────────────────────────────

const FONTS = `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=EB+Garamond:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&display=swap" rel="stylesheet">`;

const ICONS = `  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`;

function headerBar(logoHref = BASE) {
  return `    <div class="header-bar">
      <a href="${logoHref}" class="chomp-home-link" title="ps.chom.ps">
        <div class="site-logo-icon">
          <img src="https://ik.imagekit.io/chompchomp/logo-default_01ng4rCAq.png" alt="chom.ps" class="logo-default">
          <img src="https://ik.imagekit.io/chompchomp/logo-hover_Xkgt_S3PG.jpg" alt="chom.ps" class="logo-hover">
        </div>
      </a>
      <div class="nav-tools-dropdown">
        <button class="menu-toggle" onclick="toggleToolsDropdown()">☰</button>
        <button class="tools-dropdown-btn" onclick="toggleToolsDropdown()">Menu ▼</button>
        <ul class="tools-dropdown-menu" id="toolsDropdown">
          <li><a href="https://chom.ps">Chomp</a></li>
          <li><a href="https://chom.ps/about">About</a></li>
          <li><a href="https://chom.ps/store">Store</a></li>
          <li><a href="https://chom.ps/tools/">Lab</a></li>
          <li><a href="https://chom.ps/tools/ipsum">Ipsum</a></li>
        </ul>
      </div>
    </div>`;
}

const DROPDOWN_JS = `  <script>
    function toggleToolsDropdown() {
      var d = document.getElementById('toolsDropdown');
      var c = document.querySelector('.nav-tools-dropdown');
      if (d) d.classList.toggle('active');
      if (c) c.classList.toggle('active');
    }
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.nav-tools-dropdown')) {
        var d = document.getElementById('toolsDropdown');
        var c = document.querySelector('.nav-tools-dropdown');
        if (d) d.classList.remove('active');
        if (c) c.classList.remove('active');
      }
    });
  </script>`;

function colophon() {
  return `    <footer class="site-colophon">
      <div class="colophon-inner">
        <div class="colophon-line">An archive of zen baking and chomp theory</div>
        <div class="colophon-line small"><a href="/about/">About</a> · <a href="/feed.xml">rss</a> · <a href="mailto:db@chom.ps">db@chom.ps</a> · <a href="https://chom.ps">chom.ps</a></div>
      </div>
    </footer>`;
}

// ── Page renderers ─────────────────────────────────────────

async function renderHome(env) {
  const index = await getIndex(env);
  const posts = index.filter(p => !p.status || p.status === 'published');
  const recent = posts.slice(0, 20);

  const items = recent.length === 0
    ? '      <p class="empty">No posts yet.</p>'
    : recent.map(p => `      <a class="post-list-item" href="/${p.slug}/">
        <div class="post-list-meta">
          <span class="post-list-date">${formatDate(p.date)}</span>
          ${p.eyebrow ? `<span class="post-list-eyebrow">${p.eyebrow}</span>` : ''}
        </div>
        <div class="post-list-title">${p.title}</div>
        ${p.excerpt ? `<div class="post-list-excerpt">${p.excerpt}</div>` : ''}
      </a>`).join('\n');

  const more = posts.length > 20 ? '      <a class="post-list-more" href="/archive/">All posts →</a>' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${TITLE}</title>
  <meta property="og:title" content="${TITLE}">
  <meta property="og:description" content="${DESC}">
  <meta property="og:image" content="https://ik.imagekit.io/chompchomp/ps%20link%20sharing">
  <meta property="og:url" content="${BASE}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://ik.imagekit.io/chompchomp/ps%20link%20sharing">
${FONTS}
  <link rel="stylesheet" href="/style.css">
${ICONS}
  <link rel="alternate" type="application/rss+xml" title="${TITLE}" href="/feed.xml">
</head>
<body>
  <div class="page">

    <header class="ps-header">
${headerBar('https://chom.ps')}
      <div class="ps-banner">
        <img src="https://ik.imagekit.io/chompchomp/postscript%20light" alt="postscript" class="banner-light">
        <img src="https://ik.imagekit.io/chompchomp/postscript%20dark" alt="postscript" class="banner-dark">
      </div>
    </header>

    <div class="post-list">
${items}
${more}
    </div>

${colophon()}

  </div>
${DROPDOWN_JS}
</body>
</html>`;
}

async function renderArchive(env) {
  const index = await getIndex(env);
  const posts = index.filter(p => !p.status || p.status === 'published');

  const items = posts.map(p => `      <a class="post-list-item" href="/${p.slug}/">
        <div class="post-list-meta">
          <span class="post-list-date">${formatDate(p.date)}</span>
          ${p.eyebrow ? `<span class="post-list-eyebrow">${p.eyebrow}</span>` : ''}
        </div>
        <div class="post-list-title">${p.title}</div>
        ${p.excerpt ? `<div class="post-list-excerpt">${p.excerpt}</div>` : ''}
      </a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Archive – ${TITLE}</title>
${FONTS}
  <link rel="stylesheet" href="/style.css">
${ICONS}
</head>
<body>
  <div class="page">

${headerBar()}

    <header class="post-header">
      <h1>Archive</h1>
      <hr>
    </header>

    <div class="post-list">
${items}
    </div>

${colophon()}

  </div>
${DROPDOWN_JS}
</body>
</html>`;
}

function renderAbout() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About – ${TITLE}</title>
${FONTS}
  <link rel="stylesheet" href="/style.css">
${ICONS}
</head>
<body>
  <div class="page">

${headerBar()}

    <header class="post-header">
      <h1>About</h1>
      <hr>
    </header>

    <div class="post-body markdown about">
      <p>A personal, lyrical blog about the meditative side of everyday cooking and baking — less about recipes and more about the quiet rituals, patience, and emotional texture that surround them.</p>
      <p>Moments like middle-of-the-night cookie baking or a temperamental oven become entry points into deeper reflections on grief, presence, and finding meaning in small acts.</p>
      <p class="meta"><a href="mailto:db@chom.ps">db@chom.ps</a></p>
    </div>

    <div class="post-back" style="margin-top: var(--space-xl);">
      <a href="/">← All posts</a>
    </div>

${colophon()}

  </div>
${DROPDOWN_JS}
</body>
</html>`;
}

async function renderPost(slug, env) {
  const post = await getPost(env, slug);
  if (!post) return null;
  if (post.status && post.status !== 'published' && post.status !== 'unlisted') return null;

  const contentHtml = post.contentHtml || marked.parse(post.content || '');
  const wc = post.wordCount || 0;
  const rt = post.readingTime || 1;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.title} – ${TITLE}</title>
  <meta property="og:title" content="${post.title}">
  <meta property="og:description" content="${post.excerpt || DESC}">
  <meta property="og:image" content="https://ik.imagekit.io/chompchomp/ps%20link%20sharing">
  <meta property="og:url" content="${BASE}/${slug}/">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://ik.imagekit.io/chompchomp/ps%20link%20sharing">
${FONTS}
  <link rel="stylesheet" href="/style.css">
${ICONS}
</head>
<body>
  <div class="page">

${headerBar()}

    <header class="post-header">
      ${post.eyebrow ? `<p class="kicker">${post.eyebrow}</p>` : ''}
      <h1>${post.title}</h1>
      <p class="meta">${formatDate(post.date)}</p>
      <hr>
    </header>

    <div class="post-body markdown${post.mode ? ' ' + post.mode : ''}">
      ${contentHtml}
    </div>

    <div class="post-footer">
      <a href="/" class="post-back">← All posts</a>
      <span>${wc.toLocaleString()} words · ${rt} min read</span>
    </div>

${colophon()}

  </div>
  <script>
    if (window.matchMedia('(max-width: 768px)').matches) {
      document.querySelectorAll('.pdf-embed').forEach(function(embed) {
        var obj = embed.querySelector('object.pdf-frame');
        if (!obj) return;
        if (!embed.querySelector('.pdf-mobile')) {
          var div = document.createElement('div');
          div.innerHTML = obj.innerHTML;
          obj.parentNode.insertBefore(div, obj.nextSibling);
        }
        obj.remove();
      });
    }
  </script>
${DROPDOWN_JS}
</body>
</html>`;
}

async function renderFeed(env) {
  const index = await getIndex(env);
  const feedPosts = index
    .filter(p => (!p.status || p.status === 'published') && p.rss !== false)
    .slice(0, 20);

  const items = await Promise.all(feedPosts.map(async p => {
    const full = await getPost(env, p.slug);
    const contentHtml = full
      ? (full.contentHtml || marked.parse(full.content || ''))
      : '';
    return `
    <item>
      <title>${escXml(p.title)}</title>
      <link>${BASE}/${p.slug}/</link>
      <guid isPermaLink="true">${BASE}/${p.slug}/</guid>
      <pubDate>${formatRssDate(p.date)}</pubDate>
      ${p.excerpt ? `<description>${escXml(p.excerpt)}</description>` : ''}
      <content:encoded><![CDATA[${contentHtml}]]></content:encoded>
    </item>`;
  }));

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${TITLE}</title>
    <link>${BASE}</link>
    <description>${DESC}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items.join('')}
  </channel>
</rss>`;
}

// ── API handlers ───────────────────────────────────────────

async function handleAPI(request, path, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // GET /api/posts — list all posts (auth required, for admin)
  if (path === '/api/posts' && request.method === 'GET') {
    if (!checkAuth(request, env)) return jsonResp(401, { error: 'Unauthorized' });
    return jsonResp(200, await getIndex(env));
  }

  // /api/posts/:slug
  const m = path.match(/^\/api\/posts\/([a-z0-9][a-z0-9-]*)$/);
  if (!m) return jsonResp(404, { error: 'Not found' });

  const slug = m[1];

  // GET /api/posts/:slug — full post data (auth required)
  if (request.method === 'GET') {
    if (!checkAuth(request, env)) return jsonResp(401, { error: 'Unauthorized' });
    const post = await getPost(env, slug);
    if (!post) return jsonResp(404, { error: 'Not found' });
    return jsonResp(200, post);
  }

  // PUT /api/posts/:slug — create or update (auth required)
  if (request.method === 'PUT') {
    if (!checkAuth(request, env)) return jsonResp(401, { error: 'Unauthorized' });

    let data;
    try { data = await request.json(); } catch { return jsonResp(400, { error: 'Invalid JSON' }); }

    const wc = wordCount(data.content || '');
    const contentHtml = marked.parse(data.content || '');

    const post = {
      slug,
      title:       data.title   || '',
      date:        data.date    || new Date().toISOString().slice(0, 10),
      content:     data.content || '',
      contentHtml,
      wordCount:   wc,
      readingTime: Math.max(1, Math.ceil(wc / 200)),
    };
    if (data.eyebrow)     post.eyebrow = data.eyebrow;
    if (data.excerpt)     post.excerpt = data.excerpt;
    if (data.mode)        post.mode    = data.mode;
    if (data.status)      post.status  = data.status;
    if (data.rss === false) post.rss   = false;

    await putPost(env, slug, post);

    // Update the index
    const index = await getIndex(env);
    const meta = { slug, title: post.title, date: post.date, wordCount: post.wordCount, readingTime: post.readingTime };
    if (post.eyebrow) meta.eyebrow = post.eyebrow;
    if (post.excerpt) meta.excerpt = post.excerpt;
    if (post.status)  meta.status  = post.status;
    if (post.rss === false) meta.rss = false;

    const idx = index.findIndex(p => p.slug === slug);
    if (idx >= 0) index[idx] = meta; else index.push(meta);
    index.sort((a, b) => new Date(b.date) - new Date(a.date));
    await putIndex(env, index);

    return jsonResp(200, { ok: true, slug });
  }

  // DELETE /api/posts/:slug (auth required)
  if (request.method === 'DELETE') {
    if (!checkAuth(request, env)) return jsonResp(401, { error: 'Unauthorized' });
    await kvDeletePost(env, slug);
    const index = await getIndex(env);
    await putIndex(env, index.filter(p => p.slug !== slug));
    return jsonResp(200, { ok: true });
  }

  return jsonResp(405, { error: 'Method not allowed' });
}

// ── 404 ────────────────────────────────────────────────────

function render404() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not found – ${TITLE}</title>
${FONTS}
  <link rel="stylesheet" href="/style.css">
${ICONS}
</head>
<body>
  <div class="page">
    <div class="not-found">
      <h2>Page not found</h2>
      <p><a href="/">← Back to home</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ── Main ───────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname;

    try {
      // OPTIONS preflight (CORS)
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS });
      }

      // API
      if (path.startsWith('/api/')) {
        return handleAPI(request, path, env);
      }

      // Dynamic pages
      if (path === '/' || path === '') {
        return htmlResp(200, await renderHome(env));
      }

      if (path === '/archive' || path === '/archive/') {
        return htmlResp(200, await renderArchive(env));
      }

      if (path === '/about' || path === '/about/') {
        return htmlResp(200, renderAbout());
      }

      if (path === '/feed.xml') {
        return new Response(await renderFeed(env), {
          headers: { 'Content-Type': 'application/rss+xml;charset=UTF-8', 'Cache-Control': 'no-cache' },
        });
      }

      // Post slugs: /some-slug or /some-slug/
      const slugMatch = path.match(/^\/([a-z0-9][a-z0-9-]*)\/?$/);
      if (slugMatch) {
        const postHtml = await renderPost(slugMatch[1], env);
        if (postHtml) return htmlResp(200, postHtml);
      }

      // Fall through to static assets (CSS, favicons, /admin/, /pdfs/)
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error('Worker error:', err);
      return new Response('Internal server error', { status: 500 });
    }
  },
};
