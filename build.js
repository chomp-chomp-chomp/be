const ejs = require('ejs');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatRssDate(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').toUTCString();
}

function wordCount(markdown) {
  return markdown.replace(/[#*`_[\]()>~]/g, ' ').split(/\s+/).filter(Boolean).length;
}

function render(template, data) {
  const src = fs.readFileSync(path.join('views', template), 'utf8');
  return ejs.render(src, data, { filename: path.join('views', template) });
}

function write(filePath, html) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html);
  console.log('wrote', filePath);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ── Load posts ────────────────────────────────────────────

const allBuiltPosts = fs.readdirSync('posts')
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const post = JSON.parse(fs.readFileSync(path.join('posts', f), 'utf8'));
    post.contentHtml = marked.parse(post.content);
    post.wordCount = wordCount(post.content);
    post.readingTime = Math.max(1, Math.ceil(post.wordCount / 200));
    return post;
  })
  .filter(post => !post.status || post.status === 'published' || post.status === 'unlisted')
  .sort((a, b) => new Date(b.date) - new Date(a.date));

// unlisted posts get their page but are excluded from home/archive listings
const posts = allBuiltPosts.filter(post => !post.status || post.status === 'published');

// ── Build ─────────────────────────────────────────────────

fs.rmSync('docs', { recursive: true, force: true });
fs.mkdirSync('docs');

// Preserve CNAME for GitHub Pages custom domain
const cnameFile = 'CNAME';
if (fs.existsSync(cnameFile)) {
  fs.copyFileSync(cnameFile, path.join('docs', cnameFile));
}

// Public assets
copyDir('public', 'docs');
console.log('copied public/');

// Admin editor — hash plain-text credentials from env and inject
const crypto = require('crypto');
copyDir('admin', path.join('docs', 'admin'));
const adminPath = path.join('docs', 'admin', 'index.html');
let adminHtml = fs.readFileSync(adminPath, 'utf8');
const hashOf = s => s ? crypto.createHash('sha256').update(s).digest('hex') : '';
adminHtml = adminHtml.replace('__ADMIN_USER_HASH__',  hashOf(process.env.ADMIN_USER     || ''));
adminHtml = adminHtml.replace('__ADMIN_PW_HASH__',   hashOf(process.env.ADMIN_PASSWORD  || ''));
fs.writeFileSync(adminPath, adminHtml);
console.log('copied admin/');

// Home page
write('docs/index.html', render('index.ejs', { posts, formatDate }));

// Archive page
write('docs/archive/index.html', render('archive.ejs', { posts, formatDate }));

// About page
write('docs/about/index.html', render('about.ejs', {}));

// 404 page
write('docs/404.html', render('404.ejs', {}));

// RSS feed (opt-in: only posts with rss: true)
const rssPosts = posts.filter(p => p.rss !== false);
write('docs/feed.xml', render('feed.ejs', { posts: rssPosts, formatRssDate, buildDate: new Date().toUTCString() }));

// Post pages
for (const post of allBuiltPosts) {
  write(path.join('docs', post.slug, 'index.html'), render('post.ejs', { post, formatDate }));
}

console.log(`\nBuilt ${allBuiltPosts.length} post(s) → docs/`);
