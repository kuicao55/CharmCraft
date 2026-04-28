# InteractionManager — Manual Verification Checklist

This file documents the manual verification steps for InteractionManager.js.
No automated test file is required per task specification.

---

## Environment Setup

Before testing, ensure:
- `index.html` loads Matter.js via CDN `<script>` tag
- ES modules are supported (`type="module"` on script tag)
- `PhysicsScene.js` and `CharmManager.js` are loaded before this module

---

## Checklist

### 1. Click to Select
- [ ] Click on a charm body
- [ ] Charm gets highlighted (strokeStyle `#ff6b6b`, lineWidth `3` appear around the body)
- [ ] `this.selectedCharm` points to the correct body

### 2. Click to Deselect
- [ ] Click on blank area (not on any charm)
- [ ] Previously selected charm loses highlight (strokeStyle `null`, lineWidth `0`)
- [ ] `this.selectedCharm` becomes `null`

### 3. Drag Charm
- [ ] Drag a charm with mouse
- [ ] Charm moves freely — MouseConstraint active
- [ ] `Matter.MouseConstraint` is attached to `scene.engine` and world

### 4. Release Charm — Re-constrain to Ring
- [ ] After dragging, release the charm
- [ ] Charm snaps back or stays near ring due to spring constraint
- [ ] Constraint is added back to `scene.engine.world` with `bodyA = ring`

### 5. Delete Key Removes Charm
- [ ] Select a charm
- [ ] Press `Delete` or `Backspace`
- [ ] Charm is removed from scene (via `CharmManager.removeCharm`)
- [ ] Charm is no longer rendered

### 6. Toolbar Delete Removes Charm
- [ ] Select a charm
- [ ] Call `interactionManager.deleteByToolbar()`
- [ ] Charm is removed from scene
- [ ] `onDelete` callback fires (if set)

---

## Notes

- `onDelete` is a simple property set by `app.js`: `interactionManager.onDelete = () => { ... }`
- MouseConstraint body is added to world via `Matter.Composite.add(scene.engine.world, ...)`
- Drag start removes constraint from world but keeps it tracked in `_draggedConstraint`
- Drag end re-creates `bodyA` from current `ring` (handles replaceRing scenario)
- `_isCharmBody` uses `charmManager.constraints.some(c => c.bodyB.id === body.id)` as specified