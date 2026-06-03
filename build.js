// 单文件交付构建：把 index.html + src/logic.js + src/game.js 内联为 dist/index.html
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFile(join(ROOT, p), "utf8");

const [html, logic, game] = await Promise.all([
  read("index.html"),
  read("src/logic.js"),
  read("src/game.js")
]);

// 将两个外链 <script> 替换为内联脚本，得到完全自包含的单文件
const inlined = html.replace(
  /<script src="src\/logic\.js"><\/script>\s*<script src="src\/game\.js"><\/script>/,
  `<script>\n${logic}\n</script>\n<script>\n${game}\n</script>`
);

if (inlined === html) {
  throw new Error("未找到可替换的 <script> 引用，构建中止");
}

await mkdir(join(ROOT, "dist"), { recursive: true });
const out = join(ROOT, "dist", "index.html");
await writeFile(out, inlined, "utf8");

const kb = (Buffer.byteLength(inlined, "utf8") / 1024).toFixed(1);
console.log(`✓ 单文件构建完成：dist/index.html （${kb} KB，纯前端可直接双击运行）`);
