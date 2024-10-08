# DuoNat Codebase Overview

## Project Structure

The DuoNat project is primarily written in JavaScript, with HTML and CSS for the frontend. The codebase is organized into several key directories and files:

- `index.html`: The main HTML file for the application.
- `html/dialogs/*`: The HTML files for the app's dialogs. 
- `code/`: Contains most of the JavaScript modules.
- `styles/`: Contains CSS files for styling the application.
- `data/`: Contains JSON files with taxon information and pairs.
- `images/`: Likely contains image assets used in the application.

## Non-code files
+ I have a package.json in the root folder sarefo.github.io
+ another package.json in the /DuoNat folder
+ and a third package.jos in the /DuoNat/server folder. there's also a .env file there.
+ there's a Procfile in the root folder

## Key JavaScript Modules

### Core Application Logic

+ `main.js`: Entry point for the application, initializes various components.
+ `gameLogic.js`: Implements game rules and mechanics.
+ `state.js`: Manages the application's state.

### UI and Interaction

+ `ui.js`: Manages user interface updates and interactions.
+ `hintSystem.js`: Setting up the hints on the game screen
+ `dialogManager.js`: Manages dialogs in the application.
++ `searchHandler.js`: Search functionality
+ `events/eventMain.js`: Handles user input and events. Calls the following modules (also in events/ folder):
++ `eventInitializer.js`: Initializing general events
++ `eventUIButtons.js`: Main screen button functionality
++ `keyboardShortcuts.js`: Global keyboard shortcuts
++ `swipeHandler.js`: Swiping on the main screen
++ `dragAndDrop.js`: Implements drag-and-drop functionality.

### Component-Specific Modules

+ dialog-specific modules are in code/dialogs
+ `ancestryDialog.js`: Visualizes taxonomic relationships between two active taxa.
+ `ancestryPopup.js`: provides per-node functionality in the ancestryDialog.
+ `collectionManager.js` : Handles the collection manager dialog and its components.
+ `enterPair.js`: Code for the 'Enter new pair' dialog.
+ `infoDialog.js` : Handles the info dialog and its components.
+ `iNatDownDialog.js` : Handles the iNaturalist down detector dialog
+ `rangeSelector.js`: Handles geographical range selection.
+ `phylogenySelector.js` : Handles the phylogeny selection dialog.
+ `reporting.js`: Code for the reporting dialog.
+ `sharing.js`: Code for sharing dialog.
+ `tagSelector.js`: Manages the tag cloud feature.

### Data Management and API

+ `api.js`: Handles API calls to iNaturalist and local data fetching.
+ `preloader.js`: Manages preloading of images and data.
+ `pairManager.js`: Manages taxon pairs, including loading them
+ `roundManager.js`: Manages loading game rounds
+ `taxonomyHierarchy.js`: class with hierarchy of game's taxonomic content
+ `cache.js`: Caching using Dexie and IndexedDB

### Utilities and Helpers

+ `config.js`: Stores configuration settings.
+ `errorHandling.js`: Error handling.
+ `installPrompt.js`: Prompts mobile users to install the web app.
+ `logger.js`: Provides logging functionality.
+ `url.js`: Loading and writing URL parameters.
+ `utils.js`: Contains utility functions used throughout the application.

### Visualization and Special Features

+ `worldMap.js`: Handles rendering and interaction with world maps.
+ `d3Graphs.js`: Creates D3.js-based graphs for data visualization. The corresponding modules are in the d3/ folder.

### Server-side code
+ server/ contains the code that is supposed to be pushed to Heroku. Heroku has auto-deployment from github enabled, so no need to manually push code there.
+ server/public is normally not used, it's just for testing purposes, as Heroku should only be responsible for the backend.

## HTML Structure

The `index.html` file contains the main structure of the application, including:

- Loading screen
- Game container
- UI elements like buttons and overlays

The dialogs all have their own html files, in html/dialogs/.

## CSS Organization

The CSS is organized into several files:

- `main.css`: Main CSS file that imports others.
- `base.css`: Base styles and CSS reset.
- `components/`: Directory containing CSS for specific components.
- `layout/`: CSS for layout-specific styles.

## Data Files
These are about to be replaced with MongoDB collections.
1. `taxonInfo.json`: Contains detailed information about individual taxa.
2. `taxonPairs.json`: Defines pairs of taxa used in the game.
3. `taxonHierarchy.json`: Represents the taxonomic hierarchy of species.

## Helper scripts outside of web app
- `server/backup_mongodb.js`: backs up the collections.
- `server/restore_mongodb.js`: writes the local JSON files to MongoDB, overwriting the collections there.

## Key Features and Concepts

1. Taxon pair system for quiz gameplay.
2. Drag-and-drop interface for answering questions.
3. Dynamic loading and preloading of taxon information and images.
4. Integration with iNaturalist API for taxon data.
5. Visualization of taxonomic relationships.
6. Geographical filtering using world map selection.
7. Tag-based filtering of taxon pairs.
8. Responsive design for various device sizes.

## Coding Best Practices

- Functions from other modules can only be accessed via their public API.
- For console output, use logger.debug() (or logger.warn() / logger.error()).
- Try not to have functions that are longer than 50 lines. Instead, break them into subfunctions, so that the flow can be easily understood by a human. Let's adhere to the Single Responsibility Principle.
- The code should be efficient, while allowing a reader to follow the logic of interaction of elements such as preloading etc.

## Notes for Future Development

- The codebase is modular, allowing for easy expansion of features.
- There's a focus on performance optimization, especially with image preloading.
- The project uses modern JavaScript features and follows a component-based architecture.
- Most of the code uses ES modules. But the server/ backend part uses Node.js with Express.js.
- There's an emphasis on maintaining a smooth user experience across devices.
- I want to start using Firebase, at least for user management, maybe also for hosting and messaging.
- It's important to be able to add taxon pair data to the database soon, in a semi-automatic, robust way.
- The app should also be able to determine the location of the user (or they provide it), and then filter for "near here" taxa.

## Advice to LLM
When working on specific features or bug fixes, you can request relevant modules based on this overview. For example, if working on the drag-and-drop functionality, you'd primarily need `dragAndDrop.js`, `eventHandlers.js`, and possibly `gameLogic.js`. Note that the user may already have provided some of them at the beginning of a discussion.
