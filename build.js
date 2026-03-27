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

const posts = fs.readdirSync('posts')
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const post = JSON.parse(fs.readFileSync(path.join('posts', f), 'utf8'));
    post.contentHtml = marked.parse(post.content);
    return post;
  })
  .sort((a, b) => new Date(b.date) - new Date(a.date));

// ── Build ─────────────────────────────────────────────────

fs.rmSync('docs', { recursive: true, force: true });
fs.mkdirSync('docs');

// Preserve CNAME for GitHub Pages custom domain
const cnameFile = 'CNAME';
if (fs.existsSync(cnameFile)) {
  fs.copyFileSync(cnameFile, path.join('docs', cnameFile));
}

// Public assets
for (const file of fs.readdirSync('public')) {
  fs.copyFileSync(path.join('public', file), path.join('docs', file));
  console.log('copied', file);
}

// Admin editor
copyDir('admin', path.join('docs', 'admin'));
console.log('copied admin/');

// Home page
write('docs/index.html', render('index.ejs', { posts, formatDate }));

// Archive page
write('docs/archive/index.html', render('archive.ejs', { posts, formatDate }));

// Post pages
for (const post of posts) {
  write(path.join('docs', post.slug, 'index.html'), render('post.ejs', { post, formatDate }));
}

console.log(`\nBuilt ${posts.length} post(s) → docs/`);
