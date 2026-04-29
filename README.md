# CharmCraft

> A browser-based charm and keychain DIY tool with real-time Matter.js physics simulation.

[🌐 Live Demo](#) · [📦 Upload Your Own Charm](#upload) · [🔧 Tech Stack](#tech-stack)

---

CharmCraft lets you design custom charm necklaces and keychains entirely in the browser. Drag charms onto a virtual ring, fine-tune their placement with physics, and export your creation — no install required.

![CharmCraft Preview](assets/preview.png)

---

## Features

### 🎨 Interactive Physics Playground
- Real-time physics simulation powered by [Matter.js](https://brm.io/matter-js/)
- Charms attach to the ring via spring constraints and respond to gravity and collisions
- Drag, select, and reposition charms freely on the canvas

### ✨ Custom Charm Library
- Pre-loaded set of curated charms (cardinal directions, compass points)
- Upload any PNG to create custom charms from your own artwork
- Automatic contour detection for accurate physics bodies

### 🔗 Custom Rings
- Multiple ring styles to choose from
- All charms reconnect automatically when you switch rings

### 📱 Runs Anywhere
- Pure browser-based — works on desktop and mobile
- No build step required, no accounts needed

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/kuicao55/CharmCraft.git
cd CharmCraft

# Install dev dependencies
npm install

# Start the dev server
node server.js
```

Then open **http://localhost:3000** in your browser.

---

## Usage

### Adding a Ring
1. Click a ring thumbnail in the sidebar
2. The ring appears at the top of the canvas
3. Existing charms automatically reconnect to the new ring

### Adding Charms
1. Click a charm thumbnail in the sidebar
2. The charm appears attached to the ring via spring
3. Drag it around — physics handles the rest

### Upload Custom Charm
1. Scroll to the **Upload** section in the sidebar
2. Drop a PNG file (or click to browse)
3. The charm is uploaded to the server and appears in the picker instantly

### Delete Charms
1. Click a charm to select it
2. Press `Delete` or `Backspace` to remove it

---

## Project Structure

```
CharmCraft/
├── server.js              # Express dev server with static file serving
├── index.html             # SPA entry point
├── style.css              # Application styles
├── src/
│   ├── app.js             # Bootstrap — wires all modules together
│   ├── PhysicsScene.js    # Matter.js world, renderer, ring body
│   ├── CharmManager.js    # Charm body creation + constraint management
│   ├── InteractionManager.js  # Mouse/touch drag, select, delete
│   ├── PngToBody.js       # PNG → Matter.js contour body + attach point
│   ├── Sidebar.js         # Ring/charm picker UI
│   └── UploadUI.js        # PNG dropzone upload UI
├── assets/
│   ├── manifest.json      # Ring and charm asset manifest
│   ├── rings/             # Ring PNG assets
│   └── charms/            # Charm PNG assets
└── tests/
    └── Integration.manual.md
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Physics | [Matter.js](https://brm.io/matter-js/) |
| Server | Express.js |
| Frontend | Vanilla JS (ES modules) |
| Styling | CSS3 |
| Build | None — runs directly in browser |

---

## Uploading Custom Charms {#upload}

The upload system automatically:

1. **Validates** the PNG file (type + dimensions)
2. **Uploads** to `/api/upload` on the dev server
3. **Registers** it in `assets/manifest.json`
4. **Refreshes** the sidebar picker so it appears immediately

Custom uploads are stored in `assets/charms/` and `assets/rings/` on the server.

---

## License

ISC
