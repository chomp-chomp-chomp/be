/**
 * ps.chom.ps — Cloudflare Worker
 *
 * Self-contained — no npm imports, no Assets binding required.
 * Paste directly into the Cloudflare dashboard editor.
 *
 * KV structure (binding name: POSTS):
 *   posts-index   → JSON array of post metadata, sorted newest-first
 *   post:{slug}   → Full post JSON (must include contentHtml)
 *   admin-html    → The admin editor HTML (paste public/admin/index.html here)
 *
 * Secrets:  ADMIN_TOKEN — Bearer token for /api/* write endpoints
 */

// ── Inline CSS ─────────────────────────────────────────────
// (mirrors public/style.css — update both when the stylesheet changes)

const CSS = `/* =========================================================
   CHOMP / BE TYPOGRAPHIC SYSTEM
   ========================================================= */

:root {
  --bg: #fffdf9;
  --surface: #fffdf9;
  --text: #231f1f;
  --muted: #666666;
  --light-muted: #777777;
  --rule: #e6e6e6;
  --accent: #ff0032;
  --link: #231f1f;
  --link-hover: #ff0032;
  --quote-text: #444444;
  --code-bg: #f7f5f0;
  --code-border: #e6e6e6;
  --table-rule: #e6e6e6;
  --selection-bg: rgba(255, 0, 50, 0.12);
  --max-text: 680px;
  --max-recipe: 640px;
  --max-wide: 1100px;
  --space-xs: 8px;
  --space-s: 16px;
  --space-m: 24px;
  --space-l: 40px;
  --space-xl: 64px;
  --space-xxl: 96px;
  --font-masthead: "EB Garamond", Garamond, serif;
  --font-title: "Cormorant Garamond", Garamond, serif;
  --font-body: "Source Serif 4", Georgia, serif;
  --font-ui: "Inter", Arial, sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
  --soft: #444444;
}

html[data-theme="dark"] {
  --bg: #231f1f; --surface: #231f1f; --text: #ededed; --muted: #c4c4c4;
  --light-muted: #aaaaaa; --soft: #bbbbbb; --rule: #3a3535; --accent: #ff4d6d;
  --link: #ededed; --link-hover: #ff4d6d; --quote-text: #d9d9d9;
  --code-bg: #2a2626; --code-border: #3a3535; --table-rule: #3a3535;
  --selection-bg: rgba(255, 77, 109, 0.18);
}

@media (prefers-color-scheme: dark) {
  html:not([data-theme="light"]) {
    --bg: #231f1f; --surface: #231f1f; --text: #ededed; --muted: #c4c4c4;
    --light-muted: #aaaaaa; --soft: #bbbbbb; --rule: #3a3535; --accent: #ff4d6d;
    --link: #ededed; --link-hover: #ff4d6d; --quote-text: #d9d9d9;
    --code-bg: #2a2626; --code-border: #3a3535; --table-rule: #3a3535;
    --selection-bg: rgba(255, 77, 109, 0.18);
  }
}

*, *::before, *::after { box-sizing: border-box; }
html { font-size: 100%; -webkit-text-size-adjust: 100%; text-rendering: optimizeLegibility; background: var(--bg); }
body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font-body); font-size: 18px; line-height: 1.6; }
::selection { background: var(--selection-bg); }
img { max-width: 100%; height: auto; display: block; }

.page { max-width: var(--max-text); margin: 0 auto; padding: var(--space-xl) 20px; }
.page--recipe { max-width: var(--max-recipe); }
.page--wide { max-width: var(--max-wide); }
.narrow { max-width: var(--max-text); margin-left: auto; margin-right: auto; }

h1, h2, h3, h4, h5, h6 { font-family: var(--font-title); font-weight: 500; color: var(--text); margin-top: 0; }
h1 { font-size: 48px; line-height: 1.2; margin-bottom: var(--space-m); }
h2 { font-size: 36px; line-height: 1.25; margin-top: var(--space-xl); margin-bottom: var(--space-s); }
h3 { font-size: 28px; line-height: 1.3; margin-top: 32px; margin-bottom: 12px; }
h4 { font-size: 22px; line-height: 1.35; margin-top: var(--space-l); margin-bottom: 10px; }
h5, h6 { font-family: var(--font-ui); font-size: 14px; line-height: 1.4; letter-spacing: 0.03em; text-transform: uppercase; color: var(--muted); margin-top: var(--space-l); margin-bottom: var(--space-xs); }
p { margin-top: 0; margin-bottom: var(--space-s); }
.lead { font-size: 21px; line-height: 1.55; margin-bottom: var(--space-m); }
.small { font-size: 16px; line-height: 1.6; }
.caption { font-family: var(--font-ui); font-size: 13px; line-height: 1.4; color: var(--muted); }
em, i { font-style: italic; }
strong, b { font-weight: 600; }

a { color: var(--link); text-decoration-thickness: 1px; text-underline-offset: 2px; }
a:hover { color: var(--link-hover); }
.post-body a { color: var(--accent); }
.post-body a:hover { color: var(--link-hover); }

.ps-header { margin-bottom: var(--space-xl); }
.header-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-s); }
.chomp-home-link { display: inline-block; text-decoration: none; flex-shrink: 0; }
.site-logo-icon { position: relative; width: 44px; height: 44px; display: inline-block; }
.site-logo-icon img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; position: absolute; top: 0; left: 0; transition: opacity 0.3s ease, transform 0.35s ease; }
.logo-default { opacity: 0; transform: scale(0.55); }
.logo-hover { opacity: 1; transform: scale(1); }
.chomp-home-link:hover .logo-default, .chomp-home-link:active .logo-default, .chomp-home-link:focus-visible .logo-default { opacity: 1; transform: scale(1); }
.chomp-home-link:hover .logo-hover, .chomp-home-link:active .logo-hover, .chomp-home-link:focus-visible .logo-hover { opacity: 0; transform: scale(1.45); }
.ps-page-logo { display: flex; align-items: center; line-height: 0; text-decoration: none; flex-shrink: 0; }
.ps-logo-light { display: block; height: 60px; width: auto; }
.ps-logo-dark  { display: none;  height: 60px; width: auto; }
@media (prefers-color-scheme: dark) { html:not([data-theme="light"]) .ps-logo-light { display: none; } html:not([data-theme="light"]) .ps-logo-dark { display: block; } }
html[data-theme="dark"] .ps-logo-light { display: none; }
html[data-theme="dark"] .ps-logo-dark { display: block; }

.nav-tools-dropdown { position: relative; }
.menu-toggle { display: block; background: none; border: none; font-size: 1.4em; color: var(--text); cursor: pointer; padding: 4px 0; line-height: 1; transition: opacity 0.2s; }
.menu-toggle:hover { opacity: 0.65; }
.tools-dropdown-btn { display: none; background: none; border: none; color: var(--text); font-size: 14px; font-family: var(--font-ui); cursor: pointer; padding: 6px 10px; border-radius: 4px; transition: background-color 0.2s, color 0.2s; }
.tools-dropdown-btn:hover { background-color: var(--accent); color: var(--bg); }
.tools-dropdown-menu { display: none; position: absolute; top: calc(100% + 8px); right: 0; background-color: var(--code-bg); border: 1px solid var(--rule); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); list-style: none; padding: 4px 0; min-width: 160px; z-index: 1000; }
.tools-dropdown-menu.active { display: block; }
.tools-dropdown-menu li { margin: 0; }
.tools-dropdown-menu a { display: block; padding: 10px 16px; font-family: var(--font-ui); font-size: 14px; color: var(--text); text-decoration: none; transition: background-color 0.2s, color 0.2s; }
.tools-dropdown-menu a:hover { background-color: var(--accent); color: var(--bg); }
@media (max-width: 768px) { .tools-dropdown-menu { position: fixed; top: 70px; right: 18px; width: min(90vw, 220px); max-height: calc(100vh - 80px); overflow-y: auto; } }

.ps-banner img { max-width: 100%; height: auto; }
.banner-dark { display: none; }
@media (prefers-color-scheme: dark) { html:not([data-theme="light"]) .banner-light { display: none; } html:not([data-theme="light"]) .banner-dark { display: block; } }
html[data-theme="dark"] .banner-light { display: none; }
html[data-theme="dark"] .banner-dark { display: block; }
.banner-light, .banner-dark { max-width: 100%; height: auto; margin-bottom: var(--space-m); }

.meta, .metadata, .byline, .kicker, .nav, .ui-text { font-family: var(--font-ui); }
.meta, .metadata, .meta-block { font-size: 14px; line-height: 1.4; color: var(--muted); }
.meta-block { margin: 16px 0 24px; }
.kicker { font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; color: #ff0032; margin-bottom: var(--space-s); }
.byline { font-size: 14px; color: var(--muted); margin-bottom: var(--space-m); }

.article p { margin-top: 0; margin-bottom: 0; text-indent: 1.5em; }
.article p + p { margin-top: 0; }
.article p:first-child, .article .lead + p, .article h1 + p, .article h2 + p, .article h3 + p, .article h4 + p, .article blockquote + p, .article hr + p, .article figure + p, .article .meta-block + p, .article .pullquote + p, .article .note-block + p, .article .section-break + p { text-indent: 0; }

.recipe p, .instructions p, .about p, .tool-copy p { margin-bottom: var(--space-s); text-indent: 0; }

ul, ol { margin-top: 0; margin-bottom: var(--space-m); padding-left: 1.25rem; }
.ingredients ul, .ingredients ol, .meta-list, .ui-list { font-family: var(--font-ui); font-size: 15px; line-height: 1.6; }
li + li { margin-top: 4px; }

blockquote { margin: 32px 0; padding-left: 20px; border-left: 2px solid var(--rule); font-family: var(--font-body); font-size: 17px; line-height: 1.6; font-style: italic; color: var(--quote-text); }
blockquote p:last-child { margin-bottom: 0; }
cite { display: block; margin-top: 8px; font-family: var(--font-ui); font-size: 13px; font-style: normal; color: var(--muted); }
.pullquote { margin: 48px 0; font-family: var(--font-title); font-size: 28px; line-height: 1.3; text-align: center; color: var(--text); }

hr { border: 0; border-top: 1px solid var(--rule); margin: 48px 0; }
.section-break { margin: 48px 0; text-align: center; font-family: var(--font-title); font-size: 20px; color: var(--light-muted); letter-spacing: 0.08em; }

figure { margin: 32px 0; }
figcaption { margin-top: 10px; font-family: var(--font-ui); font-size: 13px; line-height: 1.4; color: var(--muted); }

.pdf-embed { margin: var(--space-l) 0; position: relative; }
.pdf-embed::after { content: "↕  scroll"; position: absolute; bottom: 42px; right: 14px; font-family: var(--font-ui); font-size: 10px; letter-spacing: 0.05em; color: #fff; background: rgba(0,0,0,0.48); padding: 3px 9px; border-radius: 10px; pointer-events: none; opacity: 0; transition: opacity 0.2s ease; z-index: 2; }
.pdf-embed:hover::after { opacity: 1; }
.pdf-frame { display: block; width: 100%; height: 360px; border: 1px solid var(--rule); border-radius: 8px; background: var(--code-bg); }
.pdf-cover { display: block; width: 100%; height: auto; border: 1px solid var(--rule); border-radius: 8px; }
.pdf-mobile { display: none; }
.pdf-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; text-decoration: none; color: var(--muted); font-family: var(--font-ui); font-size: 14px; border-radius: 7px; gap: 6px; }
.pdf-placeholder:hover { color: var(--accent); }
@media (max-width: 768px) { .pdf-frame { display: none; } .pdf-mobile { display: block; } .pdf-mobile.pdf-placeholder { display: flex; height: 80px; border: 1px solid var(--rule); border-radius: 8px; } }

.site-nav { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: var(--space-xl); font-family: var(--font-ui); font-size: 15px; line-height: 1.4; }
.site-nav a { text-decoration: none; }
.site-nav a:hover { text-decoration: underline; }

.recipe-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px 20px; margin: 24px 0 32px; font-family: var(--font-ui); font-size: 14px; line-height: 1.4; color: var(--muted); }
.recipe-meta strong { display: block; color: var(--text); font-weight: 600; }
.ingredients { margin-top: 24px; }
.instructions ol { font-family: var(--font-body); font-size: 18px; line-height: 1.65; }
.instructions li + li { margin-top: 12px; }
.note { margin-top: 24px; font-size: 16px; font-style: italic; }

.markdown { max-width: var(--max-text); }
.markdown > :first-child { margin-top: 0; }
.markdown .lead { font-size: 21px; line-height: 1.55; margin-bottom: var(--space-m); }
.markdown .note-block { margin: 24px 0; padding-left: 16px; border-left: 1px solid var(--rule); font-size: 16px; font-style: italic; color: var(--muted); }
.markdown .pullquote { margin: 48px 0; font-family: var(--font-title); font-size: 28px; line-height: 1.3; text-align: center; color: var(--text); }
.markdown .aside { margin: 24px 0; font-size: 16px; color: var(--muted); }
.markdown .section-break { margin: 48px 0; text-align: center; font-family: var(--font-title); font-size: 20px; color: var(--light-muted); letter-spacing: 0.08em; }
.markdown figure { margin: 32px 0; }
.markdown figcaption { margin-top: 10px; font-family: var(--font-ui); font-size: 13px; line-height: 1.4; color: var(--muted); }
.markdown .recipe-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px 20px; margin: 24px 0 32px; font-family: var(--font-ui); font-size: 14px; line-height: 1.4; color: var(--muted); }
.markdown .recipe-meta strong { display: block; color: var(--text); font-weight: 600; }

code, pre, kbd, samp { font-family: var(--font-mono); }
code { font-size: 0.9em; }
pre { overflow-x: auto; padding: 16px; margin: 24px 0; background: var(--code-bg); border: 1px solid var(--code-border); font-size: 14px; line-height: 1.5; }

table { width: 100%; border-collapse: collapse; margin: 24px 0; font-family: var(--font-ui); font-size: 14px; line-height: 1.4; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--table-rule); }
th { font-weight: 600; color: var(--text); }
td { color: var(--muted); }

.site-colophon { margin-top: var(--space-xxl); padding-top: var(--space-l); border-top: 1px solid var(--rule); text-align: center; color: var(--muted); }
.colophon-inner { display: flex; flex-direction: column; gap: 6px; }
.colophon-inner .colophon-line:first-child { font-family: var(--font-title); font-size: 18px; font-weight: 500; color: var(--text); letter-spacing: 0.02em; }
.colophon-line { font-family: var(--font-ui); font-size: 13px; line-height: 1.6; color: var(--muted); }
.colophon-line a { color: var(--muted); text-decoration: none; }
.colophon-line a:hover { color: var(--link-hover); }

.center { text-align: center; } .left { text-align: left; } .muted { color: var(--muted); } .accent { color: var(--accent); }
.serif { font-family: var(--font-body); } .ui { font-family: var(--font-ui); } .masthead-font { font-family: var(--font-masthead); }
.title-font { font-family: var(--font-title); } .mono { font-family: var(--font-mono); } .smallcaps { font-variant: small-caps; letter-spacing: 0.04em; }

.post-list { margin-top: var(--space-l); }
.post-list-item { display: block; padding: var(--space-m) 0; border-bottom: 1px solid var(--rule); color: inherit; text-decoration: none; transition: opacity 0.2s; }
.post-list-item:first-child { border-top: 1px solid var(--rule); }
.post-list-item:hover { opacity: 0.65; text-decoration: none; }
.post-list-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.post-list-date { font-family: var(--font-ui); font-size: 13px; color: var(--muted); }
.post-list-eyebrow { font-family: var(--font-ui); font-size: 11px; color: #ff0032; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
.post-list-title { font-family: var(--font-title); font-size: 26px; font-weight: 500; color: var(--text); line-height: 1.25; margin-bottom: 5px; }
.post-list-excerpt { font-family: var(--font-ui); font-size: 14px; color: var(--muted); line-height: 1.55; }
.post-list-more { display: block; padding: var(--space-m) 0; font-family: var(--font-ui); font-size: 14px; color: var(--muted); text-decoration: none; }
.post-list-more:hover { color: var(--link-hover); }
.empty { padding: var(--space-xl) 0; font-family: var(--font-ui); font-size: 15px; color: var(--muted); font-style: italic; }

.post-header { margin-bottom: var(--space-l); }
.post-header hr { margin-top: var(--space-m); margin-bottom: 0; }
.post-body { margin-top: var(--space-l); font-family: var(--font-body); font-size: 18px; line-height: 1.6; }
.post-body img { border-radius: 8px; margin: 8px auto 24px; }
.post-footer { margin-top: var(--space-xl); padding-top: var(--space-m); border-top: 1px solid var(--rule); display: flex; flex-direction: column; gap: var(--space-m); font-family: var(--font-ui); font-size: 13px; color: var(--muted); }
.post-back { font-family: var(--font-ui); font-size: 14px; }
.post-back a { color: var(--link); text-decoration: none; }
.post-back a:hover { color: var(--link-hover); }
.not-found { text-align: center; padding: var(--space-xxl) 0; }
.not-found h2 { font-family: var(--font-title); font-size: 32px; font-weight: 500; }
.not-found p { font-family: var(--font-ui); color: var(--muted); margin: 0; }

@media (max-width: 768px) {
  body { font-size: 17px; }
  .page, .page--recipe, .page--wide { padding: 32px 18px; }
  h1 { font-size: 34px; } h2 { font-size: 28px; } h3 { font-size: 22px; }
  .lead { font-size: 19px; }
  .pullquote, .markdown .pullquote { font-size: 22px; }
  .meta, .metadata, .byline, .site-nav, table { font-size: 13px; }
  .article p { text-indent: 1.25em; }
  .post-list-title { font-size: 22px; }
}`;

// ── Constants ──────────────────────────────────────────────

const BASE  = 'https://ps.chom.ps';
const TITLE = '.ps';
const DESC  = 'An archive of zen baking and chomp theory';

// ── Helpers ────────────────────────────────────────────────

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatRssDate(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').toUTCString();
}

function escXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function htmlResp(status, body) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' },
  });
}

function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

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
  const raw = await env.POSTS.get('post:' + slug);
  return raw ? JSON.parse(raw) : null;
}
async function putPost(env, slug, post) {
  await env.POSTS.put('post:' + slug, JSON.stringify(post));
}
async function kvDelete(env, slug) {
  await env.POSTS.delete('post:' + slug);
}

// ── Shared HTML fragments ──────────────────────────────────

const FONTS = `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=EB+Garamond:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&display=swap" rel="stylesheet">`;

const ICONS = `  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`;

function headerBar(logoHref, psLogo) {
  const cookieLink = `      <a href="${logoHref || BASE}" class="chomp-home-link" title="ps.chom.ps">
        <div class="site-logo-icon">
          <img src="https://ik.imagekit.io/chompchomp/logo-default_01ng4rCAq.png" alt="chom.ps" class="logo-default">
          <img src="https://ik.imagekit.io/chompchomp/logo-hover_Xkgt_S3PG.jpg" alt="chom.ps" class="logo-hover">
        </div>
      </a>`;
  if (psLogo) {
    return `    <div class="header-bar">
      <a href="/" class="ps-page-logo">
        <img src="https://ik.imagekit.io/chompchomp/Iightps.jpeg" class="ps-logo-light" alt=".ps">
        <img src="https://ik.imagekit.io/chompchomp/darkps.jpeg" class="ps-logo-dark" alt=".ps">
      </a>
${cookieLink}
    </div>`;
  }
  return `    <div class="header-bar">
${cookieLink}
      <div class="nav-tools-dropdown">
        <button class="menu-toggle" onclick="toggleToolsDropdown()">&#9776;</button>
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
    function toggleToolsDropdown(){var d=document.getElementById('toolsDropdown'),c=document.querySelector('.nav-tools-dropdown');if(d)d.classList.toggle('active');if(c)c.classList.toggle('active');}
    document.addEventListener('click',function(e){if(!e.target.closest('.nav-tools-dropdown')){var d=document.getElementById('toolsDropdown'),c=document.querySelector('.nav-tools-dropdown');if(d)d.classList.remove('active');if(c)c.classList.remove('active');}});
  <\/script>`;

function colophon() {
  return `    <footer class="site-colophon">
      <div class="colophon-inner">
        <div class="colophon-line">An archive of zen baking and chomp theory</div>
        <div class="colophon-line small"><a href="/about/">About</a> &middot; <a href="/feed.xml">rss</a> &middot; <a href="mailto:db@chom.ps">db@chom.ps</a> &middot; <a href="https://chom.ps">chom.ps</a></div>
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
          ${p.eyebrow ? '<span class="post-list-eyebrow">' + p.eyebrow + '</span>' : ''}
        </div>
        <div class="post-list-title">${p.title}</div>
        ${p.excerpt ? '<div class="post-list-excerpt">' + p.excerpt + '</div>' : ''}
      </a>`).join('\n');

  const more = posts.length > 20 ? '      <a class="post-list-more" href="/archive/">All posts &rarr;</a>' : '';

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
          ${p.eyebrow ? '<span class="post-list-eyebrow">' + p.eyebrow + '</span>' : ''}
        </div>
        <div class="post-list-title">${p.title}</div>
        ${p.excerpt ? '<div class="post-list-excerpt">' + p.excerpt + '</div>' : ''}
      </a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Archive &ndash; ${TITLE}</title>
${FONTS}
  <link rel="stylesheet" href="/style.css">
${ICONS}
</head>
<body>
  <div class="page">
${headerBar(null, true)}
    <header class="post-header"><h1>Archive</h1><hr></header>
    <div class="post-list">${items}</div>
${colophon()}
  </div>
</body>
</html>`;
}

function renderAbout() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About &ndash; ${TITLE}</title>
${FONTS}
  <link rel="stylesheet" href="/style.css">
${ICONS}
</head>
<body>
  <div class="page">
${headerBar(null, true)}
    <header class="post-header"><h1>About</h1><hr></header>
    <div class="post-body markdown about">
      <p>A personal, lyrical blog about the meditative side of everyday cooking and baking &mdash; less about recipes and more about the quiet rituals, patience, and emotional texture that surround them.</p>
      <p>Moments like middle-of-the-night cookie baking or a temperamental oven become entry points into deeper reflections on grief, presence, and finding meaning in small acts.</p>
      <p class="meta"><a href="mailto:db@chom.ps">db@chom.ps</a></p>
    </div>
    <div class="post-back" style="margin-top:var(--space-xl)"><a href="/">&larr; All posts</a></div>
${colophon()}
  </div>
</body>
</html>`;
}

async function renderPost(slug, env) {
  const post = await getPost(env, slug);
  if (!post) return null;
  if (post.status && post.status !== 'published' && post.status !== 'unlisted') return null;

  // contentHtml is pre-rendered by the admin/migration script at save time
  const body = post.contentHtml || ('<pre>' + (post.content || '') + '</pre>');
  const wc = post.wordCount || 0;
  const rt = post.readingTime || 1;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.title} &ndash; ${TITLE}</title>
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
${headerBar(null, true)}
    <header class="post-header">
      ${post.eyebrow ? '<p class="kicker">' + post.eyebrow + '</p>' : ''}
      <h1>${post.title}</h1>
      <p class="meta">${formatDate(post.date)}</p>
      <hr>
    </header>
    <div class="post-body markdown${post.mode ? ' ' + post.mode : ''}">
      ${body}
    </div>
    <div class="post-footer">
      <a href="/" class="post-back">&larr; All posts</a>
      <span>${wc.toLocaleString()} words &middot; ${rt} min read</span>
    </div>
${colophon()}
  </div>
  <script>
    if(window.matchMedia('(max-width:768px)').matches){document.querySelectorAll('.pdf-embed').forEach(function(e){var o=e.querySelector('object.pdf-frame');if(!o)return;if(!e.querySelector('.pdf-mobile')){var d=document.createElement('div');d.innerHTML=o.innerHTML;o.parentNode.insertBefore(d,o.nextSibling);}o.remove();});}
  <\/script>
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
    const body = full ? (full.contentHtml || '') : '';
    return `
    <item>
      <title>${escXml(p.title)}</title>
      <link>${BASE}/${p.slug}/</link>
      <guid isPermaLink="true">${BASE}/${p.slug}/</guid>
      <pubDate>${formatRssDate(p.date)}</pubDate>
      ${p.excerpt ? '<description>' + escXml(p.excerpt) + '</description>' : ''}
      <content:encoded><![CDATA[${body}]]></content:encoded>
    </item>`;
  }));

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${TITLE}</title><link>${BASE}</link><description>${DESC}</description>
    <language>en-us</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items.join('')}
  </channel>
</rss>`;
}

// ── API handlers ───────────────────────────────────────────

async function handleAPI(request, path, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // GET /api/posts
  if (path === '/api/posts' && request.method === 'GET') {
    if (!checkAuth(request, env)) return jsonResp(401, { error: 'Unauthorized' });
    return jsonResp(200, await getIndex(env));
  }

  // /api/posts/:slug
  const m = path.match(/^\/api\/posts\/([a-z0-9][a-z0-9-]*)$/);
  if (!m) return jsonResp(404, { error: 'Not found' });
  const slug = m[1];

  if (request.method === 'GET') {
    if (!checkAuth(request, env)) return jsonResp(401, { error: 'Unauthorized' });
    const post = await getPost(env, slug);
    return post ? jsonResp(200, post) : jsonResp(404, { error: 'Not found' });
  }

  if (request.method === 'PUT') {
    if (!checkAuth(request, env)) return jsonResp(401, { error: 'Unauthorized' });
    let data;
    try { data = await request.json(); } catch { return jsonResp(400, { error: 'Invalid JSON' }); }

    // contentHtml is rendered by the client (admin or migration script) and sent here
    const post = {
      slug,
      title:       data.title       || '',
      date:        data.date        || new Date().toISOString().slice(0, 10),
      content:     data.content     || '',
      contentHtml: data.contentHtml || '',
      wordCount:   data.wordCount   || 0,
      readingTime: data.readingTime || 1,
    };
    if (data.eyebrow) post.eyebrow = data.eyebrow;
    if (data.excerpt) post.excerpt = data.excerpt;
    if (data.mode)    post.mode    = data.mode;
    if (data.status)  post.status  = data.status;
    if (data.rss === false) post.rss = false;

    await putPost(env, slug, post);

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

  if (request.method === 'DELETE') {
    if (!checkAuth(request, env)) return jsonResp(401, { error: 'Unauthorized' });
    await kvDelete(env, slug);
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
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not found &ndash; ${TITLE}</title>
${FONTS}
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="page">
    <div class="not-found"><h2>Page not found</h2><p><a href="/">&larr; Back to home</a></p></div>
  </div>
</body>
</html>`;
}

// ── Main fetch handler ─────────────────────────────────────

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

      // Stylesheet — served inline so no Assets binding is needed
      if (path === '/style.css') {
        return new Response(CSS, {
          headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=86400' },
        });
      }

      // Admin editor — served from KV key "admin-html"
      if (path === '/admin' || path === '/admin/') {
        const adminHtml = await env.POSTS.get('admin-html');
        if (!adminHtml) {
          return htmlResp(503, `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
            <h2>Admin not set up</h2>
            <p>Add the editor HTML to the <code>POSTS</code> KV namespace under the key <code>admin-html</code>.</p>
            <p>The file is <code>public/admin/index.html</code> in the repository.</p>
          </body></html>`);
        }
        return htmlResp(200, adminHtml);
      }

      // API
      if (path.startsWith('/api/')) return handleAPI(request, path, env);

      // Dynamic pages
      if (path === '/' || path === '') return htmlResp(200, await renderHome(env));
      if (path === '/archive' || path === '/archive/') return htmlResp(200, await renderArchive(env));
      if (path === '/about' || path === '/about/') return htmlResp(200, renderAbout());
      if (path === '/feed.xml') {
        return new Response(await renderFeed(env), {
          headers: { 'Content-Type': 'application/rss+xml;charset=UTF-8', 'Cache-Control': 'no-cache' },
        });
      }

      // Post slugs
      const slugMatch = path.match(/^\/([a-z0-9][a-z0-9-]*)\/?$/);
      if (slugMatch) {
        const postHtml = await renderPost(slugMatch[1], env);
        if (postHtml) return htmlResp(200, postHtml);
      }

      return htmlResp(404, render404());
    } catch (err) {
      console.error('Worker error:', err);
      return new Response('Internal server error', { status: 500 });
    }
  },
};
