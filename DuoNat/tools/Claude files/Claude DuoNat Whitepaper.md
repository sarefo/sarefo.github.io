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
+ it can have one or more "sets". each set consists of one or more "pairs". every pair consists of one or more "rounds".
+ during a "set", the game uses the same taxon set throughout. a taxon set is an array of two or more taxa.
+ during a "pair", the game uses the same taxon pair throughout. a taxon pair is selected from the current taxon set, and consists of exactly two of its taxa.
+ during a "round", a pair of images are displayed, for the currently active taxon pair. every round, there will be two different images for that same taxon pair. The user needs to guess which image belongs to which taxon.

I'm currently transitioning the app from only using taxon pairs to using taxon sets. For now, let's consider a taxon pair in the code and data to be a minimal taxon set (a taxon set which only has one taxon pair).

A pair can get its two taxa either randomly from a list of taxon sets (in taxonPairs.json), or defined by the user. The latter can happen by:
+ providing the two taxa in the URL as optional parameters, or
+ by defining them inside the app using the "Enter pair" dialog.
If no URL parameters are provided, the first session after the app starts up loads a random pair from the taxon pair list. Other options are accessed via
+ the "Random pair" (loads a random pair from the taxon pair list) or
+ "Select pair" (let's the user select a pair from the taxon pair list) options.

### Sharing
+ the user can easily share the currently active taxon pair by tapping on the "Share" icon. This creates a link to the app with the two taxa encoded in the URL.
+ once taxon sets are implemented, these could also be encoded in the URL, together with the two taxa
+ This sharing link is an important component of the game, helping with its virality, as users can easily share interesting pairs with others
+ I'd like the app to optionally display a QR code for the current session, so users can share when they're next to each other
    + not every phone has a good way of creating these, and it's often hard to find in the moment

### Main objectives
It's important that the app runs smooth, and the code is robust and stable, and easy to read, so I can expand it without losing track, or breaking dependencies or functions all the time.

#### Image preloading
One thing I'm trying to do to reach this goal is preloading of images. The current approach of preloading is like this: When the app starts up, load two images for the current taxon pair. Directly after the first round begins, the app loads another random pair of images for the same taxon pair. This pair is displayed if the user chooses to play another round of the same session.

Furthermore, directly after this preloading step, the app also preloads two images of another random pair. Let's call it the preloaded random pair, PRR. Whenever the user chooses to play another random session, this pair gets loaded, starting with those two preloaded images. If the user chooses a different session (eg selecting from a list, or entering a pair by hand), that PRR stays preloaded, as the user might later still choose to start a random session. So it's important not to preload a new random pair every time a session starts. 

Here's an outline of how I currently think the image loading should work:


|Session|Set|Pair|Round|Action                                         |Variable       |
|-------|---|----|-----|-----------------------------------------------|---------------|
|1      |1  |1   |1    |Load images for taxon pair                     |               |
|1      |1  |1   |1    |Use images from initial loading                |               |
|1      |1  |1   |1    |Preload images for round 2 taxon pair          |round_preload  |
|1      |1  |1   |1    |Preload images for session 2 taxon pair round 1|session_preload|
|1      |1  |1   |2    |Use images from round 2 preload                |round_preload  |
|1      |1  |1   |2    |Preload images for round 3 taxon pair          |round_preload  |
|       |   |    |…    |                                               |               |
|1      |1  |2   |1    |Use images from session 2 preload              |session_preload|
|1      |1  |2   |1    |Preload images for round 2 taxon pair          |round_preload  |
|1      |1  |2   |1    |Preload images for session 3 taxon pair round 1|session_preload|

### Possible uses
+ naturalist fun:
    + people just enjoy the game
+ children
    + easy sets for children, eg. "cats/dogs" or such
+ hobby taxonomists
    + people that want to become better of visually identifying taxa
+ biology students
    + people that want to have a fun and effective way of improving their professional ID skills
+ if you have other suggestions, let me know at some time

## Coding best practices
Here are some best practices regarding the coding:

I want the code to contain ample console logging, so I can figure out what happens when I run it, and to help with debugging with your assistance.

If you provide code, please either provide whole functions, or exactly tell me which lines to change, as otherwise it's sometimes confusing and time-consuming to figure this out from partial function with ellipses. I especially don't like it if you provide part of a function, then write "…other code", then provide another part of the same function. that's super confusing!

Indentation is four spaces.

## Project structure

### Main window
The main window is presented to the user at startup. That's where they will be most of their time.

### Help dialog
The help dialog contains information about the most important functions of the game.

### Info dialogs
Each picture has its own info dialog. The user can access external information about the image, iNaturalist observation or taxon there. It's also planned to implement taxon-specific identification hints that can be accessed from there.

### Enter taxa dialog
The user can currently input two taxa, which will be used in a new session. Currently there's no server-side functionality, but when there is, those can also be stored for future use. Also, once taxon sets are implemented, the user will be able to input more than two taxa. Another idea is to only input one, and the app will create a taxon set from all the sister taxa at that level.

### Select taxa dialog
Currently this displays a list of all taxon pairs, locally saved in a JSON file. In future, this will be expanded, giving different ways to access taxon sets.

### Phylogeny dialog
The phylogeny graph shows how the two active taxa are connected taxonomically. It's also a way to link to the iNaturalist taxon pages of the taxa in its entire hierarchy.

## Architectural changes
+ you suggested some big changes in the past, and I'm willing to tackle them, if it helps me later to build a better app.
+ for example, you suggested using TypeScript for this kind of app. I don't know how feasible that is for me, a single not very smart or well-trained hobby programmer

## Code sanity + cleanup
+ also, I'm always happy for suggestions regarding cleaning up my code
    + for example, removing parts that are definitely not used anymore
    + also, ideas for reducing the size of the code, if they definitely don't break any existing functionality (this is important!!)
    + simplify whenever possible; again, WITHOUT BREAKING ANY FUNCTIONALITY!
    + improve error handling
    + reduce duplication
    + consistency of code
    + optimize loading, and speed in general
    + improve and update naming of functions, variables etc.
    + implementing a CSS methodology for structure and maintainable CSS (you mentioned BEM earlier, never heard of it)
    + add a decent amount of comments
    + you also mentioned adding unit tests, to ensure the code doesn't break when modified
    + implement a consistent naming convention:
        + camelCase for variables and functions
        + PascalCase for classes
        + UPPER_CASE for constants

## Functions to implement in the future
Here are some ideas I have regarding future functionality:

### Expand taxon pairs into taxon sets
+ currently, the system only allows fair taxon pairs: two different taxa that are compared in the quiz
+ it would be nice to expand on that: having taxon sets instead, which can consist of two or more taxa. If more than two taxa are in a set, the app would create random pairs out of it for use in a session.
+ although a taxon set can contain more than two taxa, in each game session, only the same two taxa from this set would be compared to each other! otherwise it would become confusing and hard to figure out the identification traits, I think.

### Update taxon set structure
+ there should be a taxon set title, of course the list of taxa in this set, and also a taxon set identifier, and tags
+ there should be an extra array where for every taxon, the ancestry hierarchy, the vernacular name, identification tips, and maybe tags and comments should be included

### Optionally use observation images
+ right now, the app uses the taxon gallery images (up to twelve per taxon) for displaying images. That leaves out a huge number of potentially useful images that reside in the observations for any given taxon.
+ one problem with just loading random observations is that the images might be really crappy
+ one solution for this might be to use a user rating system for images, weeding out bad images, and promoting good ones

### Indicate taxa with low number of gallery images
+ if a taxon has less than 10 images, this could be logged in the console
+ alternatively, it might make more sense to have a standalone script that runs for new taxon sets, resulting in a set of taxon sets with low image gallery numbers

### Tagging system for taxon sets
+ as the list of taxon sets gets longer, it also gets unwieldy
+ one idea is to add an arbitrary number of tags to any taxon set
    + this way, taxon sets could be selected by a range of different criteria
    + possible tags would be "mimicry", "fishes", or others. open for suggestions here!
    + another option might be to locally store ancestry information (from the iNat API) for each taxon
        + this would help with ancestry connection graph creation
        + it would also help users to select for example "beetles" or "fungi", and then get only taxon pairs that fit this selection in their session(s)

### Long-press information
+ show information on what buttons do when long-pressed (on touch devices), or hover (on mouse devices), or whatever the best practice to get this information is nowadays

### Optional vernicular names
+ there could be an option to only show taxon names. this makes it easier to focus on getting the taxa right, gives them more screen space, and makes it a bit harder by not showing possibly descriptive names

### Night mode
+ it would be nice to have a night mode at some point, although because a big part of the screen estate are photographs, that will probably have a limited effect

### Handle paraphyletic groups
+ with the current "taxon pair" system, but also with the proposed "taxon set" system, taxa need to be monophyletic: otherwise they cannot be fetched from iNaturalist
+ in theory, it should be possible to have a system in place that can for example do things like "moths vs butterflies, where butterflies consist of two different families, while moths consist of all the other ones in Lepidoptera
+ however, this system may be complicating other parts, such as the rather straight-forward "taxon set" concept 

### ID hints
+ it would be nice to have optional hints to explain to the user what differentiates two taxa
+ problems:
    + high maintenance: need to be written
    + not clear when to deploy to user
        + the shown images might not display the mentioned characteristic(s)
        + if there is a range of hints, it would be overwhelming to show more than one at once

### Server-side functionality
Currently, the code is running on github.io, so there's no server-side functionality. Here are some ideas once I changed to a server that has this option:

#### Image/taxon rating system
+ users can rate images (and maybe also taxon sets) via up/down buttons. These get saved on the server, to improve future selection of images and taxon sets. For example, this could remove bad images from being presented, or good taxon sets to become promoted.

#### Taxa added by users
+ users can suggest taxon sets that might be added to the main taxon set list. 

#### Persistent user management
+ a user can register and log in or out.
+ the user profile saves the user's preferences, and things such as a list of liked and trashed 

#### Stats
+ there might be user stats, showing which taxa are hard/easy or so

#### Difficulty levels
+ taxon pairs with high failure rates might get a "hard" rating, with low failure rate "easy"
+ this might be assessed on a global level, taking in data from all users

#### Spaced repitition, learning sets
+ it would be awesome for the app to have a system to feed the user the taxon sets that are right for them at the moment, for example according to the following criteria:
    + spaced repetition: haven't seen it in a while, but not too long
        + this would need internal stats that remember when the user played that set in the past, and how successful they were
    + selection of new sets by app
        + the app would suggest new taxon sets based on the user's (stated or assumed) interests

#### Liking and trashing taxon sets
+ the user could like a taxon set, resulting in it being included in a "favorite" meta selection, that can be loaded on demand, only containing liked sets
+ the user could also trash taxon sets, which then won't be shown again to that user

### Apps for Android and iPhone
+ it would be nice to be possible to actually create apps for Android and iPhone later on, and not to need to rewrite more code than necessary
+ before getting there, it would be nice to make the user interface look and behave as much as a modern, well-designed Android appas possible.

### Long-term plans

#### Money
+ if there is actually a market for an app like this, a freemium model might be worthy of exploring.
    + what functions might be worth paying for?
+ alternatively, there could be a donation system
    + no idea if anybody ever made enough money from donations to be able to fully dedicate themselves to the creation of an app ;)

## Problems

### Coding and AI problems
+ while Claude was a big help in coming that far in creating the app, currently the complexity of the codebase, together with the limitations of Claude Sonnet 3.5, lead to many things breaking when trying to improve core functionality. This is time-consuming and frustrating Also, I'm not an expert programmer, so I hit my limit of understanding pretty fast. So it would be nice to keep an eye on how to improve the code so it's easier to understand the code (for AI and me), and so changes in one part don't easily break other parts. I'm very open to suggestions here!
+ I keep losing track of what Claude suggests to me, and because Claude does not have persistent memory regarding user prompts, so does Claude. what would be a good way to make sure longer sub-projects don't get lost in the day-to-day, but keep getting pursued?

Also, this is a long-term project. Whenever you notice that something would make sense to focus on at this moment, to make the code better, let me know. I'm happy to implement changes that help me to get more done in the future, and to end up with a more powerful, prettier and better running app.

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
+ the dialogs should be fully visible and nicely positioned and layouted on big and small screens, in landscape and portrait mode

#### Main screen layout
+ currently, the main screen is optimized for Pixel 6a phones. It should also display cleanly on smaller phones, such as iPhone 7. There should be a different display mode for widescreen displays, which ranges from laptop screens to small phone screens. During widescreen display, the images should be on the left and the right, with the name tiles between them, one above the other.
+ the text on the taxon name buttons should be nicely layouted and fully visible. There's always a taxon name, and often there's a vernacular name too. If there is no vernacular name, the taxon name should use the whole space available for both of them.
+ here's a problem I'm currently struggling with: I want the name buttons to be in the center between the top and bottom image. when the space allows, I want the two buttons next to each other. The text on both should ideally be fully visible. After the screen size gets small enough, I want the left button to be on top of the right one. This is kind of the already existing behavior, but it's not working properly. how can we design a robust CSS system that does this elegantly?

#### Cache problems
+ I currently have some functionality at the beginning of index.html to increase the version number, for cache busting
+ however, the version number needs to be manually incremented for this to work. not a big deal, but I sometimes forget, and then need to push to github again just for this
+ I kind of suspect that cache problems might be to blame for SVG icons not always loading properly from the ./images/icons.svg file
    + I checked the file, and it's fine. I could not figure out what the problem with the loading was, also not with the help of Claude.

#### Dragging not pretty
+ The name tiles look different on different systems (Windows, Android). Also the layout should be roughly the same when resting, being dragged, and after being dropped. The dragging behavior is the problem here. I tried to improve it using Claude, but the Javascript code that seems to be necessary lead to super-buggy behavior.

### Tools I'm using
+ I'm using Trello for keeping track of ideas and bugs
+ gvim with many tabs for writing the code
+ Chrome for testing
+ iPhone 7 and Pixel 6a for mobile testing
+ github for code management
+ iNaturalist and its API for taxon information
+ Discord for community management (currently, there aren't any community members apart from me)
+ Photoshop at times for icon design etc.

## LLM behavior
+ please don't start every answer with "Certainly!" :) and no need to apologize all the time.
+ if a task seems complicated, please think it through step by step, explaining your reasoning.
+ always let me know when I made a mistake or might have forgotten to add information that you need.
+ if you encounter comments in my code, never remove them. I sometimes put them there for a reason ;)

