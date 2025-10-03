# Claude Working Instructions

When working in this directory, focus only on the homepage associated with `index.html`.

## Main Files Structure

The main homepage consists of:
- `index.html` - The main homepage file with multi-language support (EN, DE, FR, ES, PT, HK, TH, ID)
- `css/` folder - Stylesheets (styles.css, language-switcher.css)
- `images/` folder - Image assets (icons, photos)
- `js/` folder - JavaScript files organized as follows:
  - `main.js` - Main application logic and initialization
  - `i18n.js` - Internationalization system
  - `translations.js` - Translation strings for all supported languages
  - `nature/` subfolder - Nature scene animation modules using Paper.js:
    - `nature-scene-manager.js` - Coordinates all nature animations
    - `theme-handler.js` - Handles theme changes
    - `water-animator.js` - Water/wave animations
    - `insect-animator.js` - Insect animations
    - `sea-star-animator.js` - Sea star animations
    - `floral-animator.js` - Floral/plant animations

## Ignore These Project Directories

The following project directories should be ignored during development:

- 2048
- DuoNat-Firebase
- Recorder
- Claude Pong
- DuoNat
- Network Monitor
- Language Highlighter
- Obsidian DuoNat
- iNat-chrome-extension
- strudel
- calendar
- langlearn

## Focus Area

Work exclusively on the main homepage files (`index.html`) and related assets in the `js/`, `css/`, and `images/` folders that support the homepage.