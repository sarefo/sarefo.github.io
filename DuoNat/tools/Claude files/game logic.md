Here is a rundown of what the program should be able to do:

The user is presented with a taxon pair, and needs to associate the name with the image. if correct, the next round starts. if wrong, the name tiles are reset. the user needs to try again.


First, some nomenclature.
• taxon pair: two taxa that the user needs to compare.
• round: when a new round starts, the taxon pair stays the same. a different random image pair of the same taxon pair as before is displayed.
• session: a new taxon pair is used for a new session. this might be random, or specified from the URL, or selected from a list of taxon pairs via the "Select pair" dialog, or entered via the "Enter pair" dialog.

This is the startup behavior I want:
• app starts
• two random images for the currently active taxon pair are fetched and placed into the game container. this only happens for the first round of the first session!
• directly after the first round starts, the app loads all images for the current taxon pair into a "current taxon image collection".
• directly after that, the app preloads all images of a random taxon pair into a "preloaded taxon image collection".
• the user plays as many rounds with the current taxon pair as desired. each round, a different random set of images from the "current taxon image collection" is displayed.
• once the user chooses to switch to a new random pair, a new session starts:
• the "preloaded taxon image collection" is now used, together with its corresponding taxon pair
• again, after the first round is fully loaded, it loads a new "preloaded taxon image collection" for another random taxon pair.
