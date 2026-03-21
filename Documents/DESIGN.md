# Design System Strategy: The High-End Crypto Dashboard

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Obsidian"**

This design system is engineered to move away from the "data-heavy spreadsheet" aesthetic of traditional finance and toward a bespoke, editorial experience. The goal is to treat portfolio data not as raw information, but as high-value assets displayed in a digital gallery. 

We achieve this through **Organic Brutalism**: combining a heavy, grounded color palette with sophisticated, overlapping layers and ultra-modern typography. The system rejects the standard rigid grid, favoring intentional white space (asymmetry) and tonal depth. By utilizing "The Digital Obsidian" ethos, we create a UI that feels carved rather than constructed—dense, premium, and authoritative.

---

## 2. Colors & Surface Philosophy
The palette is a deep exploration of charcoal (`#10131a`) and navy-tinted grays, punctuated by high-vibrancy "Electric Emerald" and "Soft Rosewood" for financial performance indicators.

### The "No-Line" Rule
**Borders are a failure of hierarchy.** In this system, 1px solid borders for sectioning are strictly prohibited. Boundaries between functional areas must be defined exclusively through background color shifts. Use the transition from `surface` to `surface-container-low` to define a sidebar, or `surface-container-highest` to define a hero element.

### Surface Hierarchy & Nesting
Think of the UI as a series of physical layers stacked on a dark workbench.
*   **Base Layer:** `surface` (`#10131a`)
*   **Sectioning Layer:** `surface-container-low` (`#191c22`)
*   **Interactive/Card Layer:** `surface-container` (`#1d2026`)
*   **Prominent/Active Layer:** `surface-container-highest` (`#32353c`)

### The "Glass & Gradient" Rule
For floating elements like dropdowns or high-level modals, utilize **Glassmorphism**. Combine the `surface_bright` token at 60% opacity with a `backdrop-blur` (16px–24px).
*   **Signature Textures:** For primary call-to-actions (CTAs), do not use flat fills. Apply a subtle linear gradient from `primary` (`#3ce36a`) to `on-primary-container` (`#00963c`) at a 135-degree angle to give the element a "lit-from-within" soul.

---

## 3. Typography
We utilize a duo-font system to balance editorial authority with functional clarity.

*   **Display & Headlines (Manrope):** A geometric sans-serif that feels engineered and modern. Large scales like `display-lg` (3.5rem) should be used for portfolio totals to create a "Big Number" impact that feels like a magazine layout.
*   **Body & Labels (Inter):** Chosen for its exceptional readability at small scales. This is the "workhorse" for secondary data points and metadata.

**Hierarchy as Identity:** Use `title-lg` for card headers but drop the opacity of the label to `on-surface-variant` (`#c5c6cd`) to ensure the numerical data (the `headline` scale) remains the focal point.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than structural shadows.

*   **The Layering Principle:** To "lift" a component, move it up one step in the Surface Hierarchy. A card sitting on `surface` should be `surface-container`. This creates a soft, natural lift.
*   **Ambient Shadows:** If an element must float (e.g., a "Buy" button over a chart), use an extra-diffused shadow.
    *   *Spec:* `0px 20px 40px rgba(0, 0, 0, 0.4)`. The shadow must never be pure black; it should feel like an ambient occlusion of the dark navy background.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke, use the `outline-variant` (`#44474d`) at 20% opacity. This creates a "breath" of a line rather than a hard boundary.

---

## 5. Components

### Buttons
*   **Primary:** Gradient of `primary` to `on-primary-container`, `rounded-md` (0.75rem), `label-md` uppercase for a "pro" feel.
*   **Secondary:** `surface-container-highest` background with `primary` text. No border.

### Data Cards
*   **Constraint:** Forbid divider lines. Use `spacing-8` (2rem) of vertical white space to separate the header from the data visualization.
*   **Styling:** Use `surface-container` with `rounded-lg` (1rem). Ensure inner padding follows `spacing-6` (1.5rem) for a luxurious, uncrowded feel.

### Input Fields
*   **State:** The default state is a subtle `surface-container-highest` fill. On focus, the container should not "glow"—instead, the `outline` token should appear at 40% opacity with a smooth 200ms transition.

### Crypto-Specific Components
*   **The Gain/Loss Indicator:** Use `primary` (`#3ce36a`) for "Profit" and `tertiary-container` (`#eb4446`) for "Loss." These should be paired with `label-sm` in a pill container with 10% opacity of the accent color.
*   **Sparklines:** Use a 2px stroke width. For gains, use a gradient stroke from `primary` to transparent.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical layouts. Let a chart take up 65% of a row while data points stack in the remaining 35%.
*   **Do** use the `spacing-16` and `spacing-24` tokens for page margins to give the content "room to breathe."
*   **Do** use `primary_fixed_dim` for icons to ensure they remain legible against deep navy surfaces.

### Don't
*   **Don't** use 100% white (#FFFFFF) for text. Always use `on-surface` (`#e1e2eb`) to prevent visual vibration on dark backgrounds.
*   **Don't** use "Drop Shadows" on cards that are part of the layout grid; only use elevation for temporary or hovering elements.
*   **Don't** use sharp corners. Every interactive element must have a minimum `rounded-sm` (0.25rem) to maintain the premium, approachable feel.
*   **Don't** use dividers or lines to separate list items. Use a slight background hover state (`surface-bright`) to indicate individual rows.