I'm currently migrating to using MongoDB with Heroku as middleware. JSON has served me well, but won't scale. Currently, I have around one megabyte of JSON data, and I want to scale up the data volume by 10-100x.

I'm using Node.js with Express.js. 

I'm trying to keep the JSON functionality functional until I'm happy with MongoDB fully replacing it. Therefore I have a switch config.useMongoDB that is set to FALSE to use JSON code.

My goal is to have an efficient RESTful API that fetches only what's needed, but caches what's possible on the user's machine, so things don't need to be fetched multiple times. I don't have a good overview over what parts should be fetched when yet.

Speed is a factor! When I fetched all data via JSON, processing was blazingly fast. Now I often have to wait a few seconds for data to appear, for example in the Collection Manager's taxon pair list. I hope we can speed that up so the user has a smooth, enjoyable experience without annoying lag.
