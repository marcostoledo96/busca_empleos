```markdown
# Design System Specification: Technical Minimalism

## 1. Overview & Creative North Star: "The Silent Architect"
This design system is built on the philosophy of **"The Silent Architect."** It rejects the decorative noise of modern SaaS interfaces in favor of a raw, technical, and hyper-functional aesthetic inspired by command-line interfaces and high-end industrial engineering.

The system breaks the "standard template" look through **Extreme Reductive Logic**. We do not use shadows to create depth; we use tonal shifts. We do not use boxes to contain content; we use typographic alignment and expansive negative space to define boundaries. The result is an interface that feels less like software and more like a high-precision instrument—unapologetically monochromatic, stark, and authoritative.

---

## 2. Colors & Surface Logic
The palette is strictly monochromatic, utilizing a sophisticated scale of grays to create "Tonal Nesting." 

### The "No-Line" Rule
Traditional borders are forbidden for sectioning. Structural separation must be achieved through:
1.  **Background Shifts:** Moving from `surface` (#131313) to `surface-container-low` (#1B1B1B).
2.  **Negative Space:** Utilizing the spacing scale (specifically `spacing-8` and `spacing-12`) to create "invisible" barriers.

### Surface Hierarchy
Rather than flat layouts, treat the UI as a series of recessed or elevated plates:
*   **Base Layer:** `surface` (#131313)
*   **De-emphasized Content:** `surface-container-lowest` (#0E0E0E)
*   **Standard Containers:** `surface-container` (#1F1F1F)
*   **Active/Interactive Layers:** `surface-container-high` (#2A2A2A)

### The Accent Exception
The only non-monochromatic color allowed is `tertiary` (#72FF70). This is reserved exclusively for high-match percentages or "Success" states in technical outputs. It should never be used for buttons or primary UI actions.

---

## 3. Typography: The Dual-Engine Scale
The system employs a strict typographic dichotomy to separate UI navigation from technical data.

### UI Engine: Inter (Sans-Serif)
Inter is used for all functional UI elements. It should be tracked slightly tighter (-1% to -2%) at larger sizes to maintain a "technical" density.
*   **Display/Headline:** Use `display-md` or `headline-sm` with `font-weight: 600`. Keep line-height tight (1.1).
*   **Body:** `body-md` (0.875rem) is the workhorse. Use `on-surface-variant` (#C6C6C6) for secondary descriptions to maintain hierarchy.

### Data Engine: JetBrains Mono (Monospace)
All AI outputs, code snippets, and metadata must use JetBrains Mono. 
*   **Technical Labels:** Use `label-sm` (Monospace) in all caps with `0.05rem` letter spacing.
*   **Output Blocks:** Use `surface-container-lowest` as a background for monospace blocks to distinguish "Data" from "Interface."

---

## 4. Elevation & Depth: Tonal Layering
Traditional elevation (Z-index) is conveyed through "The Layering Principle" rather than shadows.

*   **Tonal Stacking:** To lift a card, do not add a shadow. Instead, place a `surface-container-low` card on a `surface` background.
*   **The Ghost Border:** For high-density technical data where separation is mandatory, use a 1px line with `outline-variant` (#474747) at **10% to 20% opacity**. It should be felt, not seen.
*   **Glassmorphism:** For floating menus (e.g., command palettes), use `surface-container-highest` with a `20px` backdrop-blur and 80% opacity. This maintains the "Technical" feel while allowing the underlying data to remain contextually visible.

---

## 5. Components

### Buttons
*   **Primary:** `surface: #FFFFFF`, `on-surface: #131313`. Sharp 0px corners. No gradients.
*   **Secondary:** `outline: #919191` at 20% opacity. Text is `on-surface`.
*   **Tertiary/Ghost:** No background or border. Text only. Underline on hover (1px offset).

### Input Fields
*   **State:** Default state has no border, only a `surface-container` background. 
*   **Focus:** Transition to a 1px `Ghost Border` using `primary` (#FFFFFF) at 40% opacity. 
*   **Carets:** Always use a block-style cursor (inspired by terminals) for monospace inputs.

### Cards & Lists
*   **Dividers:** Strictly forbidden. Use a `1.4rem` (spacing-4) vertical gap to separate items.
*   **List Items:** Use `surface-container-low` on hover. The transition must be instant (0ms) or ultra-fast (50ms) to feel "raw."

### Chips
*   **Technical Tags:** Smallest `label-sm` font. Background: `surface-container-high`. No rounded corners.

---

## 6. Do’s and Don'ts

### Do:
*   **Embrace Asymmetry:** Align text to the left and use large right-hand gutters for "technical breathing room."
*   **Use Mono for Numbers:** Always use JetBrains Mono for counts, timestamps, and percentages.
*   **Strict Sharpness:** Every corner radius must be `0px`. Roundness suggests consumer-grade friendliness; we are building a professional tool.

### Don't:
*   **Don't use Gradients:** Even "subtle" gradients break the technical purity of this system.
*   **Don't use Center Alignment:** Technical documentation is rarely centered. Keep the layout anchored to a strict left-aligned grid.
*   **Don't use Icons for Everything:** Use text labels whenever possible. Icons should be reserved for universal actions (e.g., Copy, Close, Play) and must use ultra-thin 1px strokes.

### Accessibility Note
While we prioritize high contrast (Black/White), ensure that `on-surface-variant` text (Grays) maintains a minimum 4.5:1 contrast ratio against background surfaces for readability. Use `on-surface` (#E2E2E2) for all long-form reading.```