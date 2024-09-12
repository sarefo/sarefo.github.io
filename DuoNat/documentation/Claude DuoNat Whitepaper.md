# DuoNat Whitepaper for LLM agents
This file gives some context about what the DuoNat app is about, what I'm trying to achieve and so on. Please take its content into account when answering a prompt.

## App overview
### Main workflow
The web app DuoNat has the following goals:
1. provide a simple, elegant main screen, where the user is presented with two images of two taxa from iNaturalist.
2. help the user learn to distinguish the two presented taxa, based on visual clues
3. be engaging and addictive, helping the user to explore biodiversity, and become better at identifying taxa

The nomenclature for the game is like this:
+ the whole time from starting up the app to closing it is called a "session".
+ it can have one or more "pairs". every pair consists of one or more "rounds".
+ the user can filter the complete list of available taxon pairs. these filtered lists are called "collections".
+ during a "pair", the game uses the same taxon pair throughout. a taxon pair is an array of two taxa.
+ during a "round", a pair of images are displayed, for the currently active taxon pair. every round, there will be two different images for that same taxon pair. The user needs to guess which image belongs to which taxon.

A pair can get its two taxa either randomly from a list of taxon pairs (in taxonPairs.json), or defined by the user. The latter can happen by:
+ providing the two taxa in the URL as optional parameters, or
+ by defining them inside the app using the "Enter pair" dialog.
If no URL parameters are provided, the first pair after the app starts up loads a random pair from the taxon pair list. Other options are accessed via
+ "Manage collection" (let's the user select a pair from the taxon pair list) options.

### Sharing
+ the user can easily share the currently active collection and pair by tapping on the "Share" icon. This creates a link or QR to the app with the relevant information encoded in the URL.
+ This sharing link is an important component of the game, helping with its virality, as users can easily share interesting pairs with others

### Main objectives
It's important that the app runs smooth, and the code is robust and stable, and easy to read, so I can expand it without losing track, or breaking dependencies or functions all the time.

#### Image preloading

Here's an outline of how I currently think the image loading works:

|Session|Pair|Round|Action                                         |
|-------|----|-----|-----------------------------------------------|
|1      |1   |1    |Load images for taxon pair                     |
|1      |1   |1    |Use images from initial loading                |
|1      |1   |1    |Preload images for round 2                     |
|1      |1   |1    |Preload images for pair 2 round 1              |
|1      |1   |2    |Use images from round 2 preload                |
|1      |1   |2    |Preload images for round 3 taxon pair          |
|       |    |…    |                                               |
|1      |2   |1    |Use images from pair 2 preload                 |
|1      |2   |1    |Preload images for round 2 taxon pair          |
|1      |2   |1    |Preload images for pair 3 taxon pair round 1   |
|       |    |…    |                                               |

### Possible uses
+ naturalist fun:
    + people just enjoy the game
+ children
    + easy pairs for children, eg. "cats/dogs" or such
+ hobby taxonomists
    + people that want to become better of visually identifying taxa
+ biology students
    + people that want to have a fun and effective way of improving their professional ID skills

## Project structure

### Main window
The main window is presented to the user at startup. That's where they will be most of their time. The user is presented with two images, and needs to drag a name tile to one of them. If correct, the game proceeds to the next round of the same taxon pair. If incorrect, the user needs to try again.

On each image, there's an info button, which opens an info dialog. There's also a mini world map, which shows the taxon's range.

### Info dialogs
Each picture has its own info dialog. The user can access external information about the image, iNaturalist observation or taxon there. It also has a link to Wikipedia (if available). There are preliminary taxon facts (provided by Perplexity.ai on 20240726). The dialog displays over most of the UI, leaving just the image that belongs to the taxon visible.

### Help dialog
The help dialog contains information about the most important functions of the game. It has a link to a tutorial, which shows the main functions of the game.

### Collection manager dialog
Currently this displays a list of all taxon pairs, locally saved in a JSON file. The user can filter by phylogeny, tags, range or level, or search by taxon. Below is a list of taxon pairs. The user can click on one, and open it this way. There's also a "Play" button, which activates the currently filtered collection.

#### Range selection dialog
This displays a world map, where the user selects which continents to include in the "range" filter. Currently, if there are multiple continents selected, pairs where all members occur at any of them are selected (eg. Africa + Oceania selected includes pairs that have a range including Africa, or including Oceania).

#### Tag cloud dialog
This dialog currently displays all the available tags for the current filters. The idea is to replace this with a taxonomic hierarchy that's intuitive to browse, and only leave non-taxonomic tags (such as "mimicry" or "fun" here).

#### Phylogeny selector dialog
This dialog shows a radial graph of the taxon hierarchy. In the center is the active node, which is the currently active phylogeny ID of the filter. It always displays its parent node, and its child nodes. The user can traverse the hierarchy this way, and select a new phylogeny ID. This filters the collection by all taxon pairs that contain at least one taxon in that part of the tree.

### Ancestry dialog
The ancestry graph shows how the two active taxa are connected taxonomically. It's also a way to link to the iNaturalist or Wikipedia taxon pages of the taxa in its entire hierarchy. The user can also use any node to filter the collection, and then gets redirected to the collection manager.

### Enter taxa dialog
This is currently poorly maintained. The user can input two taxa, which will be used in a new pair. Currently there's no server-side functionality, but when there is, those can also be stored for future use. Also, once taxon pairs are implemented, the user will be able to input more than two taxa. Another idea is to only input one, and the app will create a taxon pairs from all the sister taxa at that level.

## Architectural changes
+ you suggested some big changes in the past, and I'm willing to tackle them, if it helps me later to build a better app.
+ for example, you suggested using TypeScript for this kind of app. I don't know how feasible that is for me, a single not very smart or well-trained hobby programmer.

## Code sanity + cleanup
+ also, I'm always happy for suggestions regarding cleaning up my code
    + for example, removing parts that are definitely not used anymore
    + also, ideas for reducing the size of the code, if they definitely don't break any existing functionality (this is important!!)
    + simplify whenever possible; again, WITHOUT BREAKING ANY FUNCTIONALITY!
    + improve error handling
    + reduce duplication
    + modularize functions in line with the Single Responsibility Principle
    + consistency of code
    + optimize loading, and speed in general
    + improve and update naming of functions, variables etc.
    + using BEM for CSS
    + add a decent amount of comments
    + I couldn't get unit tests to work, but I'm aware it's something that would help

## Problems

### Coding and AI problems
+ while Claude was a big help in coming that far in creating the app, currently the complexity of the codebase, together with the limitations of Claude Sonnet 3.5, lead to many things breaking when trying to improve core functionality. This is time-consuming and frustrating. Also, I'm not an expert programmer, so I hit my limit of understanding pretty fast. So it would be nice to keep an eye on how to improve the code so it's easier to understand the code (for AI and me), and so changes in one part don't easily break other parts. I'm very open to suggestions here!

### Testing
+ At the moment, I keep missing broken functionality, and only notice it once the code got uploaded into the production environment. That's not great. If there are some automated ways to remedy this, that would help.
+ Also, currently my workflow is like this:
    + write the code on a local machine
    + test it a bit
    + upload to github.io
+ One problem with this approach is that I don't know how to properly test my code on my local machine for Android or iPhone. I know there are emulators (I'm using the Chrome F12 "device toolbar" functionality on Windows 11). But they don't catch all the problems for example with dragging behavior: it might work well when testing on Windows, but doesn't work on my Pixel 6a, for example.
+ So I definitely need a better approach to this. One idea I'm having is to have a beta and a production version on github.io, so I can test beta versions, and move them to production once they feel ready. If you have other ideas, let me know.

### Current known bugs
#### Responsive layout
+ the dialogs should be fully visible and nicely positioned and layouted on big and small screens, in landscape and portrait mode. this is not fully working yet.

#### Main screen layout
+ currently, the main screen is optimized for Pixel 7a phones. It should also display cleanly on smaller phones, such as iPhone 7. There should be a different display mode for widescreen displays, which ranges from laptop screens to small phone screens. During widescreen display, the images should be on the left and the right, with the name tiles between them, one above the other.

#### Cache problems
+ I currently have some functionality at the beginning of index.html to increase the version number, for cache busting
+ however, the version number needs to be manually incremented for this to work. not a big deal, but I sometimes forget, and then need to push to github again just for this
+ I kind of suspect that cache problems might be to blame for SVG icons not always loading properly from the ./images/icons.svg file

### Tools I'm using
+ I'm using Trello for keeping track of ideas and bugs
+ gvim with many tabs for writing the code
+ Chrome for testing
+ iPhone 7 and Pixel 7a for mobile testing
+ github for code management
+ github.io hosts the client-facing part of the app
+ heroku is supposed to host the server-facing part of the app
+ MongoDB will carry the DB functionality, with heroku as middleware
+ iNaturalist and its API for taxon information
+ Discord for community management (currently, there aren't any community members apart from me)
+ Photoshop at times for icon design etc.

### External data processing
As I'm currently without server-side functionality, I process some data using local python scripts.
+ taxonHierarchy.json is updated using the script data/processing/hierarchy/updateHierarchy.py
+ there's a workflow for adding taxon info and pairs. this is in data/processing/taxonPairs.
+ data/processing/range has a script to add range data to pairs from single taxa.

## LLM behavior requirements
+ if a task seems complicated, please think it through step by step, explaining your reasoning.
+ always let me know when I made a mistake or might have forgotten to add information that you need.
+ if you encounter comments in my code, never remove them. I sometimes put them there for a reason ;)
+ I want the code to contain ample console logging, so I can figure out what happens when I run it, and to help with debugging with your assistance.
+ if you provide code, please either provide whole functions, or exactly tell me which lines to change, as otherwise it's sometimes confusing and time-consuming to figure this out from partial function with ellipses. I especially don't like it if you provide part of a function, then write "…other code", then provide another part of the same function. that's super confusing!
