#!/usr/bin/env node
/**
 * Migrate all posts from posts/*.json → Cloudflare KV
 *
 * Usage:
 *   node scripts/migrate-to-kv.js
 *
 * Prerequisites:
 *   - wrangler installed and authenticated (`wrangler login`)
 *   - wrangler.toml has the correct KV namespace ID
 *   - Run from repo root
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { marked } = require('marked');

function wordCount(markdown) {
  return markdown.replace(/[#*`_[\]()>~]/g, ' ').split(/\s+/).filter(Boolean).length;
}

// ── Load and enrich all posts ──────────────────────────────

const postsDir = path.join(__dirname, '..', 'posts');
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.json'));

if (files.length === 0) {
  console.error('No JSON files found in posts/');
  process.exit(1);
}

console.log(`Found ${files.length} post(s) in posts/\n`);

const allPosts = files.map(f => {
  const raw  = JSON.parse(fs.readFileSync(path.join(postsDir, f), 'utf8'));
  const wc   = wordCount(raw.content || '');
  return {
    ...raw,
    contentHtml: marked.parse(raw.content || ''),
    wordCount:   wc,
    readingTime: Math.max(1, Math.ceil(wc / 200)),
  };
}).sort((a, b) => new Date(b.date) - new Date(a.date));

// ── Build KV bulk payload ──────────────────────────────────

// Index entry — lightweight metadata only
function toMeta(post) {
  const m = {
    slug:        post.slug,
    title:       post.title,
    date:        post.date,
    wordCount:   post.wordCount,
    readingTime: post.readingTime,
  };
  if (post.eyebrow) m.eyebrow = post.eyebrow;
  if (post.excerpt) m.excerpt = post.excerpt;
  if (post.status)  m.status  = post.status;
  if (post.rss === false) m.rss = false;
  return m;
}

const index = allPosts.map(toMeta);

// KV bulk format: array of { key, value } objects
const kvPairs = [
  // Index
  { key: 'posts-index', value: JSON.stringify(index) },
  // Individual posts
  ...allPosts.map(post => ({
    key:   `post:${post.slug}`,
    value: JSON.stringify(post),
  })),
];

const tmpFile = path.join(__dirname, '..', '.kv-bulk-import.json');
fs.writeFileSync(tmpFile, JSON.stringify(kvPairs, null, 2));
console.log(`Wrote ${kvPairs.length} KV entries (1 index + ${allPosts.length} posts) to ${tmpFile}\n`);

// ── Upload via wrangler ────────────────────────────────────

try {
  console.log('Running: wrangler kv bulk put --binding POSTS ...\n');
  execSync(`wrangler kv bulk put --binding POSTS ${tmpFile}`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  console.log('\n✓ Migration complete!');
  console.log('\nPosts now live in KV. Deploy the Worker to start serving them:');
  console.log('  wrangler deploy\n');
} catch (err) {
  console.error('\n✗ wrangler kv bulk put failed.');
  console.error('Make sure wrangler is installed and you are logged in.');
  console.error('Hint: npm install -g wrangler && wrangler login\n');
  process.exit(1);
} finally {
  // Clean up temp file
  try { fs.unlinkSync(tmpFile); } catch {}
}
