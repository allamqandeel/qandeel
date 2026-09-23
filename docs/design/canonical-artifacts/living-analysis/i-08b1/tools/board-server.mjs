/* WS7R board capture server.
   Serves the workshop directory over http so the page lays out normally
   (a data: URL gives the canvas a zero-size container), and accepts the
   page's own `window.__shot` POST /save/<name> to write a PNG.           */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The workshop folder, and its parent (so WS7 can be served alongside WS7R for
// the preservation diff). fileURLToPath, not `.pathname`: on Windows the latter
// returns "/E:/.../QANDEEL%20PROJECT/..." — a leading slash and an encoded space.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SAVE = HERE;
const PORT = 8731;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.js': 'text/javascript',
};

http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url.startsWith('/save/')) {
      const name = decodeURIComponent(req.url.slice('/save/'.length));
      if (!/^[A-Za-z0-9._-]+$/.test(name)) {
        res.writeHead(400).end('bad name');
        return;
      }
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const m = /^data:image\/png;base64,(.+)$/s.exec(body.trim());
        if (!m) {
          res.writeHead(400).end('not a png data url');
          return;
        }
        const out = path.join(SAVE, name);
        fs.writeFileSync(out, Buffer.from(m[1], 'base64'));
        console.log('[saved]', name, fs.statSync(out).size, 'bytes');
        res.writeHead(200, { 'content-type': 'text/plain' }).end('ok ' + name);
      });
      return;
    }
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/' + path.basename(HERE) + '/wf-living-constellation.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(path.resolve(ROOT))) {
      res.writeHead(403).end('no');
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('404');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => console.log('board server on http://localhost:' + PORT));

