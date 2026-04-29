/**
 * server.js — Node.js dev server for CharmCraft
 *
 * Features:
 * - Static file hosting (index.html, JS, CSS, images)
 * - GET /api/manifest — returns assets/manifest.json
 * - POST /api/upload — receives PNG binary, saves to assets/{category}/
 * - POST /api/manifest — replaces assets/manifest.json with posted JSON
 * - CORS headers for cross-origin requests
 * - Auto-create assets/manifest.json with { rings: [], charms: [] } if missing
 * - Auto-create assets/rings/ and assets/charms/ directories if missing
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = 3000;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB max request body size
const ASSETS_DIR = path.join(__dirname, 'assets');
const MANIFEST_PATH = path.join(ASSETS_DIR, 'manifest.json');

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

// Ensure assets directory structure exists
function ensureAssetsStructure() {
  // Create assets/ directory if it doesn't exist
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    console.log('Created assets/ directory');
  }

  // Create rings/ and charms/ subdirectories
  const ringsDir = path.join(ASSETS_DIR, 'rings');
  const charmsDir = path.join(ASSETS_DIR, 'charms');

  if (!fs.existsSync(ringsDir)) {
    fs.mkdirSync(ringsDir, { recursive: true });
    console.log('Created assets/rings/ directory');
  }

  if (!fs.existsSync(charmsDir)) {
    fs.mkdirSync(charmsDir, { recursive: true });
    console.log('Created assets/charms/ directory');
  }

  // Create manifest.json with empty structure if it doesn't exist
  if (!fs.existsSync(MANIFEST_PATH)) {
    const defaultManifest = { rings: [], charms: [] };
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(defaultManifest, null, 2));
    console.log('Created assets/manifest.json with default structure');
  }
}

// Add CORS headers to response
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Handle CORS preflight requests
function handleOptions(req, res) {
  setCorsHeaders(res);
  res.writeHead(204);
  res.end();
}

// Serve static files
function serveStatic(req, res) {
  // Default to index.html for root path
  let rawPath = req.url === '/' ? '/index.html' : req.url;

  // Remove query strings and decode URI (safely handle malformed percent-encoding)
  let filePath;
  try {
    filePath = decodeURIComponent(rawPath.split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad URL');
    return;
  }

// Strip leading slash and ../ before joining to prevent path traversal
  let safePath = filePath.slice(1);        // remove leading /
  safePath = safePath.replace(/\.\.\//g, '');  // remove ../
  safePath = safePath.replace(/^\//, '');       // remove any remaining leading slash
  const safeFullPath = path.join(__dirname, safePath);

  // Verify the resolved path is inside __dirname
  if (!safeFullPath.startsWith(__dirname + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(safeFullPath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(safeFullPath);
    setCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
    }
  }
}

// Handle GET /api/manifest
function handleGetManifest(req, res) {
  try {
    const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
    setCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(manifest);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Should not happen after ensureAssetsStructure, but handle gracefully
      const defaultManifest = { rings: [], charms: [] };
      setCorsHeaders(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(defaultManifest));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read manifest' }));
    }
  }
}

// Handle POST /api/upload
function handleUpload(req, res) {
  setCorsHeaders(res);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const category = url.searchParams.get('category');
  const filename = url.searchParams.get('filename');

  // Validate category
  if (!category || (category !== 'rings' && category !== 'charms')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or missing category parameter. Must be "rings" or "charms".' }));
    return;
  }

  // Validate filename
  if (!filename) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing filename parameter.' }));
    return;
  }

  // Ensure filename ends with .png — use only basename and strip all path separators
  let safeFilename = path.basename(filename);
  if (!safeFilename.toLowerCase().endsWith('.png')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Filename must end with .png' }));
    return;
  }

  // Validate PNG content type if provided
  const contentType = req.headers['content-type'] || '';
  // Accept both multipart/form-data and application/octet-stream
  if (contentType && !contentType.includes('png') &&
      !contentType.includes('application/octet-stream') &&
      !contentType.includes('multipart/form-data')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Content-Type should be image/png or application/octet-stream' }));
    return;
  }

  const targetDir = path.join(ASSETS_DIR, category);
  const targetPath = path.join(targetDir, safeFilename);

  // Read the binary data from the request
  let body = [];
  let size = 0;

  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_SIZE) {
      req.destroy();
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 10MB.' }));
      return;
    }
    body.push(chunk);
  });

  req.on('end', () => {
    try {
      const buffer = Buffer.concat(body);

      // Basic PNG validation (check magic bytes)
      if (buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50 ||
          buffer[2] !== 0x4E || buffer[3] !== 0x47) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid PNG file. Missing PNG magic bytes.' }));
        return;
      }

      // Write the file
      fs.writeFileSync(targetPath, buffer);

      setCorsHeaders(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: `File saved to ${category}/${safeFilename}`,
        path: `${category}/${safeFilename}`
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Failed to save file: ${err.message}` }));
    }
  });

  req.on('error', err => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Request error: ${err.message}` }));
  });
}

// Handle POST /api/manifest
function handlePostManifest(req, res) {
  setCorsHeaders(res);
  let body = '';
  let size = 0;

  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_SIZE) {
      req.destroy();
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 10MB.' }));
      return;
    }
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      // Parse the JSON
      let manifest;
      try {
        manifest = JSON.parse(body);
      } catch (parseErr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
        return;
      }

      // Validate manifest structure
      if (typeof manifest !== 'object' || manifest === null) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Manifest must be a JSON object' }));
        return;
      }

      if (!Array.isArray(manifest.rings)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Manifest must have a "rings" array' }));
        return;
      }

      if (!Array.isArray(manifest.charms)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Manifest must have a "charms" array' }));
        return;
      }

      // Write the manifest
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

      setCorsHeaders(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Manifest updated successfully',
        ringsCount: manifest.rings.length,
        charmsCount: manifest.charms.length
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Failed to update manifest: ${err.message}` }));
    }
  });

  req.on('error', err => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Request error: ${err.message}` }));
  });
}

// Create and start the server
function createServer() {
  // Ensure assets directory structure exists
  ensureAssetsStructure();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      handleOptions(req, res);
      return;
    }

    // API routes
    if (pathname === '/api/manifest') {
      if (req.method === 'GET') {
        handleGetManifest(req, res);
      } else if (req.method === 'POST') {
        handlePostManifest(req, res);
      } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Use GET or POST.' }));
      }
      return;
    }

    if (pathname === '/api/upload') {
      if (req.method === 'POST') {
        handleUpload(req, res);
      } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
      }
      return;
    }

    // Serve static files for all other routes
    if (req.method === 'GET') {
      serveStatic(req, res);
      return;
    }

    // Fallback for non-GET, non-API routes
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Dev server running at http://localhost:${PORT}`);
    console.log(`Serving static files from ${__dirname}`);
    console.log(`Assets directory: ${ASSETS_DIR}`);
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please stop the existing server or use a different port.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });

  return server;
}

// Start the server
createServer();

// Export for testing
module.exports = { createServer };
