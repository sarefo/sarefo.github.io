Here is a rundown of what the program is currently trying to do:

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

I think I need to simplify my preloading code. Instead of the above, I now want to do this:

• directly after startup, the app loads one random image for each of the two taxa in the first session

• directly after the first round has loaded, it preloads one random image of that same taxon set, to be used in the next round.

• also, if it hasn't done so yet, it will preload one image per taxon for a new random set, instead of all the images, as it does now.

• these preloaded images for the next set are used if the user chooses to start a new random taxon set.

• only if a new random set is started, the app preloads one image per taxon of another random set. this can then be used the next time the user wants to change the set. and so on.

I attached a listing of all my code for the app. let me know how to simplify the current code to do what I now want. if you want me to change functions, either produce the whole function, or only the lines I need to change, with information on where to put them.