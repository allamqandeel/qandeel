'use strict';
/**
 * S8B-06 CP1 — a minimal RFC 6455 CLIENT for exercising the fake call gateway from Node (contract test and host proof).
 * VALIDATION TOOLING ONLY. Masked frames, FIN always, custom headers (the Authorization the frozen upgrade needs).
 */
const http = require('node:http');
const crypto = require('node:crypto');

function frame(opcode, payload, { fin = true, mask = true } = {}) {
  const len = payload.length;
  const head = [(fin ? 0x80 : 0) | opcode];
  let ext = Buffer.alloc(0);
  if (len < 126) head.push((mask ? 0x80 : 0) | len);
  else if (len < 65536) {
    head.push((mask ? 0x80 : 0) | 126);
    ext = Buffer.alloc(2);
    ext.writeUInt16BE(len);
  } else {
    head.push((mask ? 0x80 : 0) | 127);
    ext = Buffer.alloc(8);
    ext.writeBigUInt64BE(BigInt(len));
  }
  if (!mask) return Buffer.concat([Buffer.from(head), ext, payload]);
  const key = crypto.randomBytes(4);
  const body = Buffer.from(payload);
  for (let i = 0; i < body.length; i += 1) body[i] ^= key[i & 3];
  return Buffer.concat([Buffer.from(head), ext, key, body]);
}

/**
 * Opens a socket. Resolves `{ status }` for a refused upgrade, or a connection with `texts`, `binaries`, `closeCode`,
 * `sendText`, `sendBinary`, `sendRaw`, `close`, `next(predicate)`.
 */
function connect(port, { path = '/voice/calls/connect', protocol = 'qandeel.live-call.v1', token = 's806-local-synthetic-token', version = '13', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const h = { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': version, 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), ...headers };
    if (protocol !== null) h['Sec-WebSocket-Protocol'] = protocol;
    if (token !== null) h.Authorization = `Bearer ${token}`;
    const req = http.request({ host: '127.0.0.1', port, path, headers: h });
    req.on('response', (res) => {
      res.resume();
      resolve({ status: res.statusCode });
    });
    req.on('error', reject);
    req.on('upgrade', (res, socket) => {
      const conn = {
        status: 101, protocol: res.headers['sec-websocket-protocol'], texts: [], binaries: [], closeCode: null, ended: false, waiters: [],
        sendText: (obj) => socket.write(frame(1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)))),
        sendBinary: (buf) => socket.write(frame(2, buf)),
        sendRaw: (bytes) => socket.write(bytes),
        close: () => socket.destroy(),
        next(predicate, timeoutMs = 3000) {
          return new Promise((res2, rej2) => {
            const found = [...conn.texts, ...conn.binaries].find(predicate);
            if (found) return res2(found);
            const waiter = { predicate, res2 };
            conn.waiters.push(waiter);
            setTimeout(() => {
              const i = conn.waiters.indexOf(waiter);
              if (i >= 0) {
                conn.waiters.splice(i, 1);
                rej2(new Error('timeout waiting for a server frame'));
              }
            }, timeoutMs).unref();
          });
        },
        closed(timeoutMs = 3000) {
          return new Promise((res2, rej2) => {
            if (conn.ended) return res2(conn.closeCode);
            conn.onEnd = () => res2(conn.closeCode);
            setTimeout(() => rej2(new Error('timeout waiting for close')), timeoutMs).unref();
          });
        },
      };
      let buffer = Buffer.alloc(0);
      const deliver = (item) => {
        for (const w of [...conn.waiters]) if (w.predicate(item)) {
          conn.waiters.splice(conn.waiters.indexOf(w), 1);
          w.res2(item);
        }
      };
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        for (;;) {
          if (buffer.length < 2) return;
          const opcode = buffer[0] & 0x0f;
          let len = buffer[1] & 0x7f;
          let off = 2;
          if (len === 126) {
            if (buffer.length < 4) return;
            len = buffer.readUInt16BE(2);
            off = 4;
          } else if (len === 127) {
            if (buffer.length < 10) return;
            len = Number(buffer.readBigUInt64BE(2));
            off = 10;
          }
          if (buffer.length < off + len) return;
          const payload = buffer.subarray(off, off + len);
          buffer = buffer.subarray(off + len);
          if (opcode === 1) {
            const msg = JSON.parse(payload.toString('utf8'));
            conn.texts.push(msg);
            deliver(msg);
          } else if (opcode === 2) {
            const bin = Buffer.from(payload);
            conn.binaries.push(bin);
            deliver(bin);
          } else if (opcode === 8) conn.closeCode = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
        }
      });
      const end = () => {
        if (conn.ended) return;
        conn.ended = true;
        conn.onEnd?.();
      };
      socket.on('close', end);
      socket.on('error', end);
      resolve(conn);
    });
    req.end();
  });
}

module.exports = { connect, frame };
