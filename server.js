'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.zip': 'application/zip',
  '.cmd': 'application/octet-stream',
  '.bat': 'application/octet-stream',
  '.md': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://giscus.app; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://avatars.githubusercontent.com https://github.githubassets.com; connect-src 'self' https://api.github.com https://giscus.app; frame-src 'self' https://giscus.app; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relPath = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relPath);

  // Prevent directory traversal and block hidden files
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, 'index.html')) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  const relativeFromRoot = path.relative(ROOT, filePath);
  if (relativeFromRoot.split(path.sep).some((part) => part.startsWith('.'))) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const headers = {
      ...SECURITY_HEADERS,
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.zip' || ext === '.cmd' ? 'public, max-age=3600' : 'no-cache',
    };

    if (relativeFromRoot.startsWith('downloads' + path.sep)) {
      headers['Content-Disposition'] = `attachment; filename="${path.basename(filePath)}"`;
    }

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nova Optimize website running on http://localhost:${PORT}`);
});

