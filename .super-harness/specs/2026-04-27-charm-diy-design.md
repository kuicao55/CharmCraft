# Charm DIY Web Page Design

**Date:** 2026-04-27
**Status:** Draft

## Goal

Build a browser-based charm/keychain DIY web page where users can select a ring, add multiple charms, and see real-time 2D physics simulation (hanging, collision, stacking) powered by matter.js.

## Architecture

Vanilla JS single-page application with matter.js for physics and rendering. A lightweight Node.js dev server handles static file hosting and PNG upload/manifest API. Physics simulation uses matter.js built-in Render (wireframes: false) with sprite textures; rings are static bodies with hollow-ring PNG sprites, charms are dynamic bodies connected to the ring via constraints.

## Components

### PhysicsScene
- Manages `Engine`, `Render`, `Runner` lifecycle
- Ring is a static circular body fixed at top-center of canvas
- Charms are dynamic bodies with gravity, connected to ring via `Constraint`
- Exposes addCharm, removeCharm, replaceRing methods

### PngToBody
- PNG → Canvas → alpha channel scan → marching squares contour extraction
- RDP polygon simplification to reduce vertex count
- Convex decomposition via `poly-decomp` (integrated with `Bodies.fromVertices`)
- Creates body with `render.sprite.texture` set to original PNG path
- Fallback: bounding box approximation if decomposition fails
- Edge cases: alpha < 128 = transparent, take largest connected region only, scale from manifest config

### CharmManager
- Add charm: create body via PngToBody, add constraint to ring, add to world
- Remove charm: remove body + constraint from world
- Replace ring: remove old ring body, create new ring body, reconnect all charm constraints to new ring
- Max charm limit: 20

### InteractionManager
- Click charm to select (highlight via strokeStyle), click blank to deselect
- Drag charm: use `MouseConstraint` for dragging; on release, re-constrain to ring
- Add charm: drag from sidebar thumbnail onto canvas, or click thumbnail to add at default position
- Delete charm: select + Delete key, or select + toolbar delete button
- Replace ring: click ring thumbnail in sidebar

### DevServer
- Lightweight Node.js server (`server.js`)
- Static file hosting for the project
- `POST /api/upload` — receives PNG, saves to `assets/rings/` or `assets/charms/`
- `POST /api/manifest` — updates `assets/manifest.json`
- `GET /api/manifest` — returns current manifest

### UploadUI
- Drop zone + file picker at bottom of sidebar
- Preview dialog after upload: edit id, scale, density (and radius for rings), choose category (ring/charm)
- Auto-generates manifest entry with defaults (id = filename sans extension, scale = 1, density = 0.001, radius = min(width,height)/2)
- Validates PNG-only uploads

## Data Flow

```
User adds charm:
  Sidebar click/drag → InteractionManager → CharmManager.addCharm(assetConfig)
    → PngToBody.createBody(pngPath, config) → matter.js Body + sprite
    → Constraint.create(ring, charm) → Composite.add(world, [body, constraint])

User uploads PNG:
  File drop/select → UploadUI preview → POST /api/upload → saved to assets/
  → POST /api/manifest → manifest.json updated → sidebar refreshes

User replaces ring:
  Sidebar ring click → CharmManager.replaceRing(newAssetConfig)
    → Remove old ring body → Create new ring body → Reconnect all charm constraints
```

## Assets

```
assets/
├── rings/
│   ├── ring-circle.png
│   ├── ring-heart.png
│   └── ...
├── charms/
│   ├── star.png
│   ├── gem.png
│   └── ...
└── manifest.json
```

manifest.json schema:
```json
{
  "rings": [
    { "id": "ring-circle", "file": "rings/ring-circle.png", "scale": 1, "radius": 40 }
  ],
  "charms": [
    { "id": "star", "file": "charms/star.png", "scale": 0.5, "density": 0.001 }
  ]
}
```

- `scale`: controls visual and physical size
- `density`: matter.js body density (charms only)
- `radius`: physics collision radius for rings (visual is hollow PNG, physics is solid circle)

## Error Handling

| Scenario | Handling |
|----------|----------|
| PNG has no extractable contour (fully transparent or too small) | Show "Invalid image" toast, skip body creation |
| Convex decomposition fails (extreme concavity) | Fallback to bounding box, console.warn |
| Non-PNG file uploaded | Frontend validation rejects, show "PNG only" toast |
| manifest.json missing or corrupted | Generate empty manifest on startup, console.warn |
| Too many charms (>20) | Block addition, show "Max charms reached" toast |
| Dev server not running | Upload button disabled with tooltip |

## Testing Strategy

- **PngToBody unit tests**: known-shape PNGs → verify contour extraction and vertex count
- **Interaction tests**: manual verification of add/drag/delete/ring-replace flows
- **Physics tests**: manual verification of hanging, collision, stacking behavior

## Out of Scope

- 3D rendering or 3D physics
- Multiple rings (single ring only)
- Export/save design functionality
- User accounts
- Mobile responsiveness (desktop-first)
- Chain connections between charms
