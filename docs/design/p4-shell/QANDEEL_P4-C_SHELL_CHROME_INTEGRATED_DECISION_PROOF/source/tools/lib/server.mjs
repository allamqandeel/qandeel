// Static server on 127.0.0.1. Serves ROOT; no-store; refuses paths outside ROOT.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8' };

export function serve(root, port) {
  const ROOT = path.resolve(root);
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('no'); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end('404'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => srv.listen(port, '127.0.0.1', () => resolve(srv)));
}
