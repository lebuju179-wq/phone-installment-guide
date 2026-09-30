// 扫描 content/<主题>/*.md，检查 front-matter 与标题重复，生成 content/INDEX.md 和 dist/ 静态站点。
// 用法：node scripts/build.js [--check]   （--check 只做检查，不输出文件）
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');
const checkOnly = process.argv.includes('--check');

// 主题目录名 -> 显示名；新增主题时在这里加一行
const TOPICS = {
  'rate-basics': '利率与费用计算',
  'platform-compare': '平台费用对比',
  'avoid-traps': '避坑指南',
  'credit-and-repayment': '征信与还款',
};

function parseFrontMatter(text, file) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: 缺少 front-matter`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    }
    meta[kv[1]] = v;
  }
  for (const key of ['title', 'date', 'tags']) {
    if (!meta[key] || meta[key].length === 0) throw new Error(`${file}: front-matter 缺少 ${key}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: date 格式应为 YYYY-MM-DD`);
  return { meta, body: m[2] };
}

// 读取所有文章
const articles = [];
for (const topic of fs.readdirSync(CONTENT)) {
  const dir = path.join(CONTENT, topic);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (!TOPICS[topic]) throw new Error(`未登记的主题目录: ${topic}（请在 scripts/build.js 的 TOPICS 中添加）`);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const rel = `${topic}/${f}`;
    const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(dir, f), 'utf8'), rel);
    articles.push({ ...meta, topic, rel, slug: `${topic}/${f.replace(/\.md$/, '')}`, body });
  }
}

// 标题查重（忽略大小写和空白）
const seen = new Map();
const dups = [];
for (const a of articles) {
  const key = a.title.replace(/\s+/g, '').toLowerCase();
  if (seen.has(key)) dups.push(`「${a.title}」: ${seen.get(key)} 与 ${a.rel}`);
  else seen.set(key, a.rel);
}
if (dups.length) {
  console.error('发现重复标题：\n' + dups.join('\n'));
  process.exit(1);
}
articles.sort((a, b) => b.date.localeCompare(a.date));
console.log(`检查通过：${articles.length} 篇文章，无重复标题`);
if (checkOnly) process.exit(0);

// 生成 content/INDEX.md（在 GitHub 上可直接浏览）
let index = '# 文章索引\n\n> 本文件由 `npm run build` 自动生成，请勿手动编辑。\n';
for (const [topic, name] of Object.entries(TOPICS)) {
  const list = articles.filter(a => a.topic === topic);
  if (!list.length) continue;
  index += `\n## ${name}\n\n`;
  for (const a of list) index += `- [${a.title}](${a.rel}) — ${a.date} · ${a.tags.join(' / ')}\n`;
}
fs.writeFileSync(path.join(CONTENT, 'INDEX.md'), index);

// 生成静态站点
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const page = (title, inner, depth) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${'../'.repeat(depth)}style.css">
</head><body><main>
<nav><a href="${'../'.repeat(depth)}index.html">分期购机指南</a></nav>
${inner}
<footer>本站内容仅供参考，不构成金融建议。具体费率以各平台合同与页面公示为准。</footer>
</main></body></html>`;

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'scripts', 'style.css'), path.join(DIST, 'style.css'));

for (const a of articles) {
  const out = path.join(DIST, a.slug, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const header = `<h1>${esc(a.title)}</h1><p class="meta">${a.date} · ${a.tags.map(esc).join(' / ')}</p>`;
  // 文章间的 .md 相对链接改成站点路径
  const html = marked.parse(a.body).replace(/href="(?:\.\.\/)?([\w-]+\/)?([\w-]+)\.md"/g,
    (_, dir, name) => `href="../../${dir || a.topic + '/'}${name}/"`);
  fs.writeFileSync(out, page(a.title, header + html, 2));
}

let home = '<h1>分期购机指南</h1><p>讲清楚手机分期的真实成本，帮你少踩坑。</p>';
for (const [topic, name] of Object.entries(TOPICS)) {
  const list = articles.filter(a => a.topic === topic);
  if (!list.length) continue;
  home += `<h2>${esc(name)}</h2><ul>` +
    list.map(a => `<li><a href="${a.slug}/">${esc(a.title)}</a> <span class="meta">${a.date}</span></li>`).join('') +
    '</ul>';
}
fs.writeFileSync(path.join(DIST, 'index.html'), page('分期购机指南', home, 0));
console.log(`已生成 content/INDEX.md 和 dist/（${articles.length + 1} 个页面）`);
