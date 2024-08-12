# DuoNat - iNat Taxonomy Trainer

Best of both worlds: easy and fun learning experience with polished UI like Duolingo - all the awesomeness of biodiversity from iNaturalist!

DuoNat (not affiliated with Duolingo or iNat) is an interactive web application designed to help users learn and distinguish between different taxa from iNaturalist. It provides an engaging and addictive way to explore biodiversity and improve identification skills.

## Features

- Simple and elegant main screen presenting two images of different taxa from iNaturalist
- Interactive gameplay where users drag and drop taxon names to match images
- Random pair selection from a curated list of taxon pairs
- Option to enter custom taxon pairs for comparison
- Share functionality to easily share interesting taxon comparisons
- Responsive design suitable for both mobile and desktop use
- Integration with iNaturalist API for up-to-date taxon information and images

## How to Play

1. Two images of different taxa are presented on the screen.
2. Drag the taxon names at the bottom to the correct images.
3. If correct, a new round with the same taxa pair will start.
4. If incorrect, try again!
5. Swipe left or use the "Random pair" button to get a new pair of taxa.

## Installation

As DuoNat is a web application, there's no installation required for end-users. Simply visit the hosted URL to start playing.

## Development

DuoNat is built using vanilla JavaScript, HTML, and CSS. The project structure is as follows:

- `index.html`: Main HTML file
- `css/`: Contains all CSS files
- `code/`: Contains all JavaScript modules
- `images/`: Contains icons and images used in the app
- `data/`: Contains the `taxonPairs.json` file with predefined taxon pairs

### Key JavaScript Modules

- `api.js`: Handles interactions with the iNaturalist API
- `game.js`: Contains the main game logic
- `ui.js`: Manages the user interface
- `eventHandlers.js`: Manages event listeners and user interactions
- `taxaRelationshipViewer.js`: Handles the taxa relationship graph functionality

## Contributing

Contributions to DuoNat are welcome! If you have suggestions for improvements or bug fixes, please open an issue or submit a pull request.

## Future Plans

- Expand taxon pairs into taxon sets
- Implement a user rating system for images
- Add optional hints to explain differences between taxa
- Develop a spaced repetition learning system
- Create mobile apps for Android and iPhone

## Contact

You can [join the discord server](https://discord.gg/DcWrhYHmeM) and say hi!

## Debugging and Logging

This application uses a custom logger to manage debug output. The logger supports four levels of logging: ERROR, WARN, INFO, and DEBUG.

To see all log messages, including DEBUG level:

1. Open Chrome's Developer Tools (F12 or Ctrl+Shift+I)
2. Go to the Console tab
3. Ensure the log level dropdown is set to "All levels" or explicitly includes "Verbose" and "Debug"
4. In the Developer Tools settings (gear icon), under the "Console" section, make sure "Verbose" is checked in the "Log Levels"

You can adjust the log level in the `config.js` file:

```javascript
const config = {
    // ... other config options
    debug: true, // Set to false to exclude DEBUG level logs
    // ... other config options
};

---

Thank you for your interest in DuoNat! We hope this tool helps you explore and learn about the amazing biodiversity on our planet.


