const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

function getPosts() {
  const dir = path.join(__dirname, 'posts');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

app.get('/', (req, res) => {
  res.render('index', { posts: getPosts(), formatDate });
});

app.get('/:slug', (req, res) => {
  const post = getPosts().find(p => p.slug === req.params.slug);
  if (!post) return res.status(404).render('404');
  res.render('post', { post, formatDate });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
