# DevServer — Manual Verification Checklist

This file documents the manual verification steps for the Node.js dev server (`server.js`).
No automated test file is required for the server component.

---

## Environment Setup

Before testing, ensure:
- Node.js is installed (v14 or higher recommended)
- No other process is running on port 3000
- Start the server with: `node server.js`
- Server logs should show: "Dev server running at http://localhost:3000"

---

## Checklist

### 1. Server Startup
- [ ] `node server.js` starts without errors
- [ ] Console shows "Created assets/ directory" (first run only)
- [ ] Console shows "Created assets/rings/ directory" (first run only)
- [ ] Console shows "Created assets/charms/ directory" (first run only)
- [ ] Console shows "Created assets/manifest.json with default structure" (first run only)
- [ ] Server listens on port 3000

### 2. Static File Hosting
- [ ] GET http://localhost:3000/ → serves index.html (or 404 if not created yet)
- [ ] GET http://localhost:3000/index.html → serves index.html
- [ ] GET http://localhost:3000/server.js → serves server.js source
- [ ] Non-existent file returns 404 with "Not found" message
- [ ] CORS headers are present in responses (Access-Control-Allow-Origin: *)

### 3. GET /api/manifest
- [ ] GET http://localhost:3000/api/manifest returns JSON
- [ ] Response has Content-Type: application/json
- [ ] Response body is valid JSON: `{ "rings": [...], "charms": [...] }`
- [ ] Returns empty arrays on fresh install: `{ "rings": [], "charms": [] }`

### 4. POST /api/upload
- [ ] POST http://localhost:3000/api/upload without category → 400 error
- [ ] POST http://localhost:3000/api/upload with invalid category → 400 error
- [ ] POST http://localhost:3000/api/upload without filename → 400 error
- [ ] POST http://localhost:3000/api/upload with PNG → saves to assets/charms/
- [ ] POST http://localhost:3000/api/upload?category=rings → saves to assets/rings/
- [ ] Uploaded file appears in correct assets subdirectory
- [ ] Upload with non-PNG content → 400 error (invalid PNG magic bytes)
- [ ] Response includes `{ "success": true, "path": "charms/filename.png" }`

### 5. POST /api/manifest
- [ ] POST http://localhost:3000/api/manifest with valid JSON → updates manifest.json
- [ ] POST with invalid JSON → 400 error
- [ ] POST with missing rings array → 400 error
- [ ] POST with missing charms array → 400 error
- [ ] Response includes `{ "success": true, "ringsCount": N, "charmsCount": N }`
- [ ] assets/manifest.json file is updated on disk

### 6. UploadUI — Drop Zone
- [ ] UploadUI creates a visible drop zone in the container
- [ ] Drag PNG file over drop zone → visual feedback (highlight)
- [ ] Drop PNG file → preview dialog appears
- [ ] Click file picker button → file dialog opens
- [ ] Select PNG file → preview dialog appears
- [ ] Select non-PNG file → error toast appears ("PNG only")
- [ ] Drop non-PNG file → error toast appears ("PNG only")

### 7. UploadUI — Preview Dialog
- [ ] Preview dialog shows image preview
- [ ] ID field is pre-filled with filename (without extension)
- [ ] Category select shows "rings" and "charms" options
- [ ] For charms: density field is visible and editable
- [ ] For rings: radius field is visible and editable
- [ ] Cancel button closes dialog without uploading
- [ ] Confirm button triggers upload

### 8. UploadUI — Upload Flow
- [ ] After confirming upload, POST /api/upload is called with correct params
- [ ] After file upload, POST /api/manifest is called with entry
- [ ] On success: toast notification "Upload successful"
- [ ] On error: toast notification with error message
- [ ] onUpload callback is invoked after successful upload
- [ ] Sidebar or UI refreshes to show new asset

### 9. CORS
- [ ] OPTIONS request returns 204 with CORS headers
- [ ] GET /api/manifest includes Access-Control-Allow-Origin: *
- [ ] POST /api/upload includes Access-Control-Allow-Origin: *
- [ ] POST /api/manifest includes Access-Control-Allow-Origin: *

### 10. Error Handling
- [ ] Port already in use → clear error message
- [ ] Invalid PNG content → rejection with helpful message
- [ ] Server returns proper JSON error responses (not plain text)

---

## Test Commands

```bash
# Start server
node server.js

# Test GET /api/manifest
curl http://localhost:3000/api/manifest

# Test POST /api/upload (PNG file)
curl -X POST "http://localhost:3000/api/upload?category=charms&filename=test.png" \
  -H "Content-Type: image/png" \
  --data-binary @test.png

# Test POST /api/manifest
curl -X POST http://localhost:3000/api/manifest \
  -H "Content-Type: application/json" \
  -d '{"rings": [{"id": "ring1", "file": "rings/ring1.png"}], "charms": []}'

# Test CORS
curl -X OPTIONS http://localhost:3000/api/manifest -i
```

---

## Notes

- The server uses CommonJS (`require`) and is not an ES module
- PNG validation checks magic bytes (89 50 4E 47) at start of file
- Files are saved with the exact filename provided in query parameter
- Manifest is stored at `assets/manifest.json` in the project root
- The server is designed for local development only (not production)
