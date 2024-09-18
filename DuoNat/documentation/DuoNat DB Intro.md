## Overview
I'm currently migrating to using MongoDB. JSON has served me well, but won't scale. Currently, I have around one megabyte of JSON data, and I want to scale up the data volume by a factor of 10-100.

## Used modules and services
+ MongoDB
+ Heroku as middleware
+ Node.js with Express.js. 
+ IndexedDB with Dexie for local caching.

## Strategy
### Backwards compatibility
I'm trying to keep the JSON functionality fully functional until I'm happy with MongoDB fully replacing it. Therefore I have a switch config.useMongoDB that is set to FALSE to use JSON code.

### Goal
My goal is to have an efficient RESTful API that fetches only what's needed, but caches what's possible on the user's machine, so things don't need to be fetched multiple times. I don't have a good overview over what parts should be fetched when yet.

### Speed
Speed is a factor! When I fetched all data via JSON, processing was blazingly fast. Now I often have to wait a few seconds for data to appear, for example in the Collection Manager's taxon pair list. I hope we can speed that up so the user has a smooth, enjoyable experience without annoying lag.

As a first, but important step, let's optimize the app's startup. That means loading the first pair immediately, and deferring all other downloads until after that pair is fully loaded. So every bulky DB fetch will definitely have to be deferred. But we should also preload a full random level 1 pair (including images!) and cache it via Dexie, so we can instantly present that as the first pair the next time the user loads the app.

### Current and future steps
+ utilize Dexie for caching wherever possible
+ optimize MongoDB queries (indexing, efficient query structure)
+ batch related database requests together whenever possible
+ server-side aggregation: use MongoDB's aggregation framework on the server side rather than fetching large datasets and processing them client-side
+ implement pagination for large datasets, to limit the amount of data transferred in each request
