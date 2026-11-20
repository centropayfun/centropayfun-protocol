// tiny static server for local checks: node scripts/serve.mjs [dir] [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
const dir = resolve(process.argv[2] || 'dist'); const port = Number(process.argv[3] || 4173);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(dir, p); if (!f.startsWith(dir)) { res.writeHead(403).end(); return; }
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }).end(b); }
  catch { res.writeHead(404).end('not found'); }
}).listen(port, () => console.log(`serving ${dir} on http://localhost:${port}`));
