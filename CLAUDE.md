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

## Other Projects In This Repo

A handful of small apps are committed here and published as part of the site,
but they are separate projects -- leave them alone when working on the homepage:

- Claude Pong
- Network Monitor
- blood-types
- paperclip

Everything else that used to sit in this repo has moved out to `C:\dev\`, each
as its own repository. If you are looking for 2048, calendar, DuoNat-Firebase,
guide, langlearn, mony, Recorder, spider_webb, strudel, thumb-key, wayk, Audio
Bridge or any of the others, they are siblings of this repo now, not
subdirectories of it.

## Focus Area

Work exclusively on the main homepage files (`index.html`) and related assets in the `js/`, `css/`, and `images/` folders that support the homepage.