# Jugendstil Ornament SVG

## Overview
The `jugendstil-ornament.svg` file contains the floral ornament design used on the homepage. The ornament appears on both sides of the page, mirrored.

## Editing the Ornament

You can edit this SVG file using various tools:

### Recommended Tools:
- **Inkscape** (Free & Open Source): https://inkscape.org/
- **Adobe Illustrator** (Commercial)
- **Figma** (Web-based, Free/Commercial)
- **Any text editor** for direct SVG code editing

### Important Notes:

1. **Path ID**: The main path must have the ID `main-ornament-path` (this is how the JavaScript finds it)

2. **Orientation**: The ornament is designed to grow from bottom (root) to top (flowers):
   - Root/stem base: Bottom of the design
   - Flowers/decorative elements: Top of the design

3. **ViewBox**: The current viewBox is `95 35 45 135` which frames the ornament
   - You can adjust this if you change the ornament size
   - Format: `x y width height`

4. **Fill Color**: The fill color in the SVG file is ignored - the JavaScript applies the theme color dynamically

5. **Testing Changes**: After editing and saving the SVG:
   - Refresh your browser
   - The changes should appear immediately on the homepage
   - Check both light and dark themes to ensure it looks good

### File Structure:
```xml
<svg viewBox="95 35 45 135">
  <g id="ornament">
    <path id="main-ornament-path" d="..." />
  </g>
</svg>
```

## How It Works

The JavaScript (`js/nature/svg-floral-animator.js`) loads this SVG file and:
1. Extracts the path data from `#main-ornament-path`
2. Creates two instances (left and right)
3. Mirrors and positions them on the page
4. Applies theme-appropriate colors dynamically

## Troubleshooting

If the ornament doesn't appear after editing:
1. Check browser console for errors
2. Verify the path ID is still `main-ornament-path`
3. Ensure the SVG file is valid XML (use an online validator if needed)
4. Clear your browser cache
