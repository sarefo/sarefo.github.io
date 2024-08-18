# DuoNat Codebase Overview

## Project Structure

The DuoNat project is primarily written in JavaScript, with HTML and CSS for the frontend. The codebase is organized into several key directories and files:

- `index.html`: The main HTML file for the application.
- `code/`: Contains most of the JavaScript modules.
- `styles/`: Contains CSS files for styling the application.
- `data/`: Contains JSON files with taxon information and sets.
- `images/`: Likely contains image assets used in the application.

## Key JavaScript Modules

### Core Application Logic

+ `main.js`: Entry point for the application, initializes various components.
+ `gameSetup.js`: Handles setting up new games and rounds.
+ `gameLogic.js`: Implements game rules and mechanics.
+ `state.js`: Manages the application's state.

### UI and Interaction

+ `ui.js`: Manages user interface updates and interactions.
+ `mainEventHandler.js`: Handles user input and events. Calls the following modules:
++ `eventInitializer.js`: Initializing general events
++ `hintSystem.js`: Setting up the hints on the game screen
++ `keyboardShortcuts.js`: Global keyboard shortcuts
++ `searchHandler.js`: Search functionality
++ `swipeHandler.js`: Swiping on the main screen
++ `uiInteractions.js`: Main screen button functionality
+ `dragAndDrop.js`: Implements drag-and-drop functionality.
+ `dialogManager.js`: Manages dialog boxes in the application.


### Data Management and API

+ `api.js`: Handles API calls to iNaturalist and local data fetching.
+ `preloader.js`: Manages preloading of images and data.
+ `setManager.js`: Manages taxon sets and their selection.
+ `taxonomyHierarchy.js`: class with hierarchy of game's taxonomic content

### Utilities and Helpers

+ `utils.js`: Contains utility functions used throughout the application.
+ `logger.js`: Provides logging functionality.
+ `config.js`: Stores configuration settings.

### Visualization and Special Features

+ `worldMap.js`: Handles rendering and interaction with world maps.
+ `taxaRelationshipViewer.js`: Visualizes taxonomic relationships.
+ `d3Graphs.js`: Creates D3.js-based graphs for data visualization.

### Component-Specific Modules

+ `collectionManager.js` : Handles the collection manager dialog and its components.
+ `infoDialog.js` : Handles the info dialog and its components.
+ `tagSelector.js`: Manages the tag cloud feature.
+ `rangeSelector.js`: Handles geographical range selection.
+ `taxonSelector.js` : Handles the taxon selection dialog.
+ `gameUI.js`: Specific UI functions for the game interface.

### Other
+ `testingDialog.js` : Testing dialog to check out things not ready for primetime.

## HTML Structure

The `index.html` file contains the main structure of the application, including:

- Loading screen
- Game container
- Various dialogs (help, info, report, etc.)
- UI elements like buttons and overlays

## CSS Organization

The CSS is organized into several files:

- `main.css`: Main CSS file that imports others.
- `base.css`: Base styles and CSS reset.
- `components/`: Directory containing CSS for specific components.
- `layout/`: CSS for layout-specific styles.

## Data Files

1. `taxonInfo.json`: Contains detailed information about individual taxa.
2. `taxonSets.json`: Defines sets of taxa used in the game.
3. `taxonHierarchy.json`: Represents the taxonomic hierarchy of species.

## Key Features and Concepts

1. Taxon pair/set system for quiz gameplay.
2. Drag-and-drop interface for answering questions.
3. Dynamic loading and preloading of taxon information and images.
4. Integration with iNaturalist API for taxon data.
5. Visualization of taxonomic relationships.
6. Geographical filtering using world map selection.
7. Tag-based filtering of taxon sets.
8. Responsive design for various device sizes.

## Notes for Future Development

- The codebase is modular, allowing for easy expansion of features.
- There's a focus on performance optimization, especially with image preloading.
- The project uses modern JavaScript features and follows a component-based architecture.
- There's an emphasis on maintaining a smooth user experience across devices.

When working on specific features or bug fixes, you can request relevant modules based on this overview. For example, if working on the drag-and-drop functionality, you'd primarily need `dragAndDrop.js`, `eventHandlers.js`, and possibly `gameLogic.js`.
