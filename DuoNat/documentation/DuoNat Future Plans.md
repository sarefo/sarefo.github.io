## Functions to implement in the future
Here are some ideas I have regarding future functionality:

### Expand taxon pairs into taxon sets
+ currently, the system only allows for taxon pairs: two different taxa that are compared in the quiz
+ it would be nice to expand on that: having taxon sets instead, which can consist of two or more taxa. If more than two taxa are in a set, the app would create random pairs out of it for use in a pair.
+ although a taxon set can contain more than two taxa, in each game pair, only the same two taxa from this set would be compared to each other! otherwise it would become confusing and hard to figure out the identification traits, I think.

### Use taxonomic hierarchy throughout the app
+ currently, the taxonomic hierarchy is mainly used to display the relationship graph
+ it would make sense to link all ancestry data into a linked list or something
+ this could then be used for the user to browse for interesting taxon pairs
+ it could also be used to sort the taxonomic tags into a hierarchy

### Improving the tagging system
+ the user should be able to organically create personal collections by combining at least tags, ranges and levels.
+ possible tags would be "mimicry", "fishes", or others. open for suggestions here!
+ another option would be to use ancestry information, so that users can select groups according to phylogeny.
    + it would also help users to select for example "beetles" or "fungi", and then get only taxon pairs that fit this selection in their pairs

### Optionally use observation images
+ right now, the app uses the taxon gallery images (up to twelve per taxon) for displaying images. That leaves out a huge number of potentially useful images that reside in the observations for any given taxon.
+ one problem with just loading random observations is that the images might be really crappy
+ one solution for this might be to use a user rating system for images, weeding out bad images, and promoting good ones

### Indicate taxa with low number of gallery images
+ if a taxon has less than 10 images, this could be logged in the console
+ alternatively, it might make more sense to have a standalone script that runs for new taxon sets, resulting in a set of taxon sets with low image gallery numbers

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

#### Spaced repetition, learning sets
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
+ Patreon might be an option
