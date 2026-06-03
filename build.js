/*
 * 交付构建：把可直接静态托管的资源拷贝到 dist/（index.html + src/ + vendor/）。
 * 产物为纯静态文件，配合任意静态服务器（含本仓库 serve.js）即可上线（NFR-2/NFR-6）。
 * 用法：npm run build
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'dist');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(OUT, 'index.html'));
copyDir(path.join(ROOT, 'src'), path.join(OUT, 'src'));
copyDir(path.join(ROOT, 'vendor'), path.join(OUT, 'vendor'));

// 计算产物体积
let bytes = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else bytes += fs.statSync(p).size;
  }
})(OUT);

console.log(`已生成静态交付包：dist/（${(bytes / 1024 / 1024).toFixed(2)} MB）`);
console.log('部署：将 dist/ 整目录上传至任意 HTTPS 静态托管即可。本地预览：PORT=8080 node serve.js 后访问 dist。');
