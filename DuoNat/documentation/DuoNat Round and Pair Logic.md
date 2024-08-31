At app start, the URL parameters are used to set filters. If no URL parameters are present, default filters only are taken into account.
Then a random pair gets loaded. 
Directly after the first pair is fully loaded and playable, the app will preload another pair from the same filtered collection.
In addition, the images for another round of the current set will be preloaded.

When the user swipes left, the preloaded pair will be loaded. Every time a new pair gets loaded, another pair from the same filtered collection will be loaded. Every time a new round has loaded, a round from the same pair gets preloaded.

If a user changes the filters in the collection manager, there are two options:
1. the user clicks on a pair in the taxon pair list: that taxon pair gets loaded. As always, that means that another random pair from the same filtered collection gets preloaded, and that another round of that pair gets preloaded.
2. the user clicks the "Play" button. That means a random pair of the current filtered collection will be loaded. And again, it's important that another random pair from that collection gets preloaded, and another pair of the displayed pair gets preloaded.

Always make sure that the preloading happens directly after the pair or round is fully loaded. It should never get in the way of displaying things quickly. That's what preloading is all about.

Let's build out preloader, roundManager and pairManager so that the interplay between those factors is easy to understand in code, robust and efficient.
And let's do it in small baby steps, maybe one function at a time. I don't want to get stuck with code I can't grasp.
