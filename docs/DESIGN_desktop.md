# Design System Specification: The Silent Processor

## 1. Overview & Creative North Star
The Creative North Star for this system is **"The Digital Curator."** 

This system moves beyond the "app" feel into the realm of a high-end editorial terminal. It is designed to feel like a "silent processor"—an invisible, highly-intelligent layer that organizes chaos into clarity. We achieve this through **Extreme Negative Space** and **Intentional Asymmetry**. By pushing content to specific anchors and leaving vast areas of the canvas "empty," we signal to the user that every piece of data shown is deliberate and high-value. The aesthetic is inspired by the clinical precision of Ollama and the timelessness of Swiss grid systems.

## 2. Colors & Surface Logic
This is a strict monochrome environment. Contrast is our primary tool for hierarchy, not color.

### The "No-Line" Rule
Traditional sectioning with 1px borders is generally prohibited for layout containers. Instead, boundaries are defined by **Background Color Shifts**.
- **Light Mode:** Use `surface` (#FFFFFF) for the main canvas and `surface_container_low` for secondary sidebars.
- **Dark Mode:** Use `surface` (#131313) for the canvas and `surface_container_highest` (#353535) for elevated logic blocks.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, fine-milled sheets.
- **Layer 0 (Base):** `surface` (#131313 dark / #FFFFFF light).
- **Layer 1 (Cards/Sections):** `surface_container_low`.
- **Layer 2 (Popovers/Modals):** `surface_container_high`.
- **The "Glass" Rule:** For floating technical overlays, use `surface_variant` at 80% opacity with a `20px` backdrop-blur. This creates a "frosted terminal" effect that keeps the user grounded in the data beneath.

### Signature Accents
- **Success:** Use `secondary` (#bcc7de) or a subtle green text hex only for terminal status.
- **Warning:** Use `error` (#ffb4ab) strictly for critical failures.
- **CTAs:** Use a subtle gradient transition from `primary` (#ffffff) to `primary_container` (#d2d5d7) to give action buttons a tactile, premium feel without breaking the monochrome palette.

## 3. Typography
The system utilizes a dual-font strategy to separate **UI Guidance** from **AI Intelligence**.

| Level | Font Family | Token | Usage |
| :--- | :--- | :--- | :--- |
| **Display** | Inter | `display-lg` | Large, low-weighted (300) headlines for impact. |
| **Headline** | Inter | `headline-sm` | Section titles; high letter-spacing (0.05em). |
| **Body** | Inter | `body-md` | General interface text and job descriptions. |
| **Data** | JetBrains Mono | `label-md` | Match %, Salary, ID, and AI Reasoning. |
| **Technical** | JetBrains Mono | `label-sm` | Meta-data and timestamps. |

**The Editorial Rule:** Never center-align long-form text. All typography should be left-aligned to a strict vertical axis to maintain the "Terminal" feel. Use `JetBrains Mono` in uppercase for labels to emphasize the machine-driven nature of the data.

## 4. Elevation & Depth
We avoid "Material" style drop shadows. Depth is achieved through **Tonal Layering**.

- **The Layering Principle:** To lift a card, do not use a shadow. Move from `surface` to `surface_container_low`. The contrast between the two creates a natural, "milled" edge.
- **Ambient Shadows:** Only for floating elements (e.g., Command Palette). Use a `40px` blur at 4% opacity using the `on_surface` color.
- **The Ghost Border:** Where the "No-Line" rule creates legibility issues, use a "Ghost Border": `outline_variant` (#474747) at **15% opacity**. It should be felt, not seen.

## 5. Components

### Dense Data Table (The Core)
Designed for the "AI Job Hunt" overview where high density is required.
- **Structure:** 1px horizontal lines using `outline_variant` at 20% opacity. No vertical lines.
- **Headers:** `JetBrains Mono` / `label-sm` / Uppercase. `surface_container_low` background.
- **Row Hover:** Shift background to `surface_container_highest` (Dark) or `surface_container_low` (Light). Transition: `150ms ease-out`.
- **Data Cells:** Job titles in `Inter` (Medium weight), Match % in `JetBrains Mono` (Bold).

### Buttons
- **Primary:** `primary` background with `on_primary` text. No border. Radius: `sm` (0.125rem).
- **Secondary:** Transparent background with a `Ghost Border`.
- **Ghost:** No background or border. Text only. Becomes underlined on hover.

### Input Fields
- **State:** Underline only (2px). No containing box.
- **Focus:** The underline shifts from `outline_variant` to `primary`.
- **Label:** `JetBrains Mono` tiny-caps floating above the input.

### Dense Info Chips
- **Style:** Rectangular, `none` or `sm` roundedness. 
- **Color:** `surface_container_high` background with `on_surface_variant` text.

## 6. Do's and Don'ts

### Do
- **Do** use `24` (5.5rem) spacing for major section breathing room.
- **Do** mix font weights—use `Inter` Thin (200/300) for large displays to feel high-end.
- **Do** use `JetBrains Mono` for any value that is calculated by the AI.
- **Do** use white space as a structural element. If a screen feels "busy," remove borders before removing content.

### Don't
- **Don't** use standard "Blue" for links. Use `primary` (White/Black) with a 1px underline.
- **Don't** use rounded corners above `md` (0.375rem). The system should feel sharp and precise.
- **Don't** use heavy gradients. Only subtle tonal shifts are allowed.
- **Don't** use icons unless absolutely necessary. Labeling with `JetBrains Mono` is often more "Pro."