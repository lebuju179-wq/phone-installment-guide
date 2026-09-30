# 分期购机指南

讲清楚手机分期真实成本的文章合集，Markdown 源文件在 `content/`，文章目录见 [content/INDEX.md](content/INDEX.md)。

## 写新文章

1. 在 `content/<主题>/` 下新建 `.md` 文件，开头写 front-matter：
   ```
   ---
   title: 文章标题
   date: 2026-10-01
   tags: [标签1, 标签2]
   ---
   ```
2. 新主题需要先在 `scripts/build.js` 的 `TOPICS` 里登记。
3. 运行 `npm run check` 检查格式和重复标题，运行 `npm run build` 生成索引和站点（`dist/`）。

## 部署

`npm run deploy`（Cloudflare Workers 静态资源，需先 `npx wrangler login`）。
