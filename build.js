const ejs = require('ejs');
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

// ── Load posts ────────────────────────────────────────────

const posts = fs.readdirSync('posts')
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join('posts', f), 'utf8')))
  .sort((a, b) => new Date(b.date) - new Date(a.date));

// ── Build ─────────────────────────────────────────────────

// Clean and recreate docs/
fs.rmSync('docs', { recursive: true, force: true });
fs.mkdirSync('docs');

// Copy public/ assets
for (const file of fs.readdirSync('public')) {
  fs.copyFileSync(path.join('public', file), path.join('docs', file));
  console.log('copied', file);
}

// Home page
write('docs/index.html', render('index.ejs', { posts, formatDate }));

// Post pages
for (const post of posts) {
  write(path.join('docs', post.slug, 'index.html'), render('post.ejs', { post, formatDate }));
}

console.log(`\nBuilt ${posts.length} post(s) → docs/`);
