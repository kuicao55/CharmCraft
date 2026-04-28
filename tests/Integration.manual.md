# Integration Verification Checklist

Use this checklist to verify the end-to-end behaviour of the Charm DIY web page.

**Prerequisites:** Run `node server.js` from the project root, then open
`http://localhost:3000` in a browser.

---

## 1. Initial Page Load

- [ ] Page renders with a physics canvas on the left
- [ ] Sidebar is visible on the right (240 px wide)
- [ ] A default ring body is visible at the top centre of the canvas (purple circle)
- [ ] Sidebar shows at least one ring thumbnail under "Rings"
- [ ] Sidebar shows at least one charm thumbnail under "Charms"

---

## 2. Adding Charms

- [ ] Click a charm thumbnail in the sidebar
- [ ] A new charm body appears in the canvas, hanging from the ring via a spring constraint
- [ ] The charm body falls and swings naturally under gravity
- [ ] Click the same or another charm thumbnail a second time
- [ ] A second charm body is added; the two charms collide and interact via Matter.js

---

## 3. Drag Interaction

- [ ] Click and drag a charm body with the mouse
- [ ] The constraint detaches — the charm moves freely under the cursor
- [ ] Release the mouse button
- [ ] The charm re-constrains to the ring and resumes swinging

---

## 4. Delete Selected Charm

- [ ] Click a charm body in the canvas — it becomes highlighted with a red border
- [ ] Click the **Delete Selected** button in the floating toolbar
- [ ] The charm body and its constraint are removed from the scene
- [ ] No error in the browser console

---

## 5. Upload Flow

- [ ] Drag a PNG file onto the upload drop zone at the bottom of the sidebar
- [ ] A preview dialog appears showing the image and form fields (ID, Category, Density/Radius)
- [ ] Fill in an ID and click **Upload**
- [ ] A success toast appears (bottom-right corner)
- [ ] The new asset appears in the sidebar picker immediately after upload
- [ ] Clicking the newly uploaded asset adds it to the canvas

---

## 6. Replace Ring

- [ ] Click a different ring thumbnail in the sidebar (if more than one ring is present)
- [ ] The ring body in the canvas updates to the new radius / sprite
- [ ] All existing charm constraints reconnect to the new ring automatically
- [ ] Charms that were already hanging continue to hang from the new ring

---

## 7. Edge Cases

- [ ] Adding more than 20 charms — additional addCharm calls are silently rejected (no crash)
- [ ] Pressing Delete/Backspace when nothing is selected — no action, no error
- [ ] Clicking the delete button when nothing is selected — no action, no error
- [ ] Replacing the ring while charms are being dragged — drag constraint is properly cleaned up
- [ ] Loading the page while the server is offline — sidebar shows "No assets loaded." empty state