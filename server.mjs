import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const files = new Set(['index.html', 'style.css', 'app.js', 'core.js', 'renderer.js', 'timeline.js', 'settings.js', 'live-camera.js']);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const port = Number(process.env.POINT_STUDIO_PORT || 4178);
http.createServer(async (req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!files.has(name)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(path.join(root, name));
    res.writeHead(200, { 'Content-Type': types[path.extname(name)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src blob:; connect-src 'self'; object-src 'none'; base-uri 'none'" });
    res.end(body);
  } catch { res.writeHead(500); res.end('Unable to read local application file'); }
}).listen(port, '127.0.0.1', () => console.log(`Point Cloud Studio: http://127.0.0.1:${port}`));
