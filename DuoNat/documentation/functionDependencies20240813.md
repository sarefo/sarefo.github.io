Function dependencies as of 2024-08-13. Might be outdated by now.

| Module Name            | Function Name                                 | Modules that call this function                                                         |
|------------------------|-----------------------------------------------|-----------------------------------------------------------------------------------------|
| api                    | taxonomy.loadTaxonInfo                        | game, gameLogic, taxaRelationshipViewer                                                 |
| api                    | taxonomy.fetchTaxonPairs                      | eventHandlers, gameLogic, rangeSelector, setManager, tagCloud, ui                       |
| api                    | taxonomy.validateTaxon                        | dialogManager                                                                           |
| api                    | taxonomy.fetchTaxonId                         | game                                                                                    |
| api                    | taxonomy.fetchTaxonDetails                    | taxaRelationshipViewer                                                                  |
| api                    | taxonomy.getAncestryFromLocalData             | taxaRelationshipViewer                                                                  |
| api                    | taxonomy.fetchAncestorDetails                 | taxaRelationshipViewer                                                                  |
| api                    | images.fetchRandomImage                       | game, gameSetup                                                                         |
| api                    | images.fetchRandomImageMetadata               | game                                                                                    |
| api                    | images.fetchMultipleImages                    | preloader                                                                               |
| api                    | vernacular.fetchVernacular                    | eventHandlers, game, gameSetup, ui                                                      |
| api                    | externalAPIs.isINaturalistReachable           | gameSetup                                                                               |
| api                    | externalAPIs.checkWikipediaPage               | game                                                                                    |
| api                    | taxonomy.checkLocalTaxonData                  | api                                                                                     |
| api                    | taxonomy.fetchVernacularFromAPI               | api                                                                                     |
| api                    | images.fetchImageMetadata                     | api                                                                                     |
| api                    | taxonomy.getTaxonomyHierarchy                 | taxaRelationshipViewer, testingDialog                                                   |
| api                    | utils.getObservationURLFromImageURL           | gameSetup                                                                               |
| config                 | overlayColors                                 | game, gameLogic, gameSetup, ui                                                          |
| d3Graphs               | createRadialTree                              | testingDialog                                                                           |
| d3Graphs               | createHierarchicalTree                        | testingDialog                                                                           |
| dialogManager          | openDialog                                    | eventHandlers, game, rangeSelector, tagCloud, taxaRelationshipViewer, testingDialog, ui |
| dialogManager          | closeDialog                                   | eventHandlers, game, rangeSelector, tagCloud, ui                                        |
| dialogManager          | isAnyDialogOpen                               | eventHandlers                                                                           |
| dialogManager          | closeAllDialogs                               | eventHandlers                                                                           |
| dialogManager          | clearAllFilters                               | eventHandlers                                                                           |
| dialogManager          | showINatDownDialog                            | functions, gameSetup                                                                    |
| dialogManager          | hideINatDownDialog                            | gameSetup                                                                               |
| dragAndDrop            | initialize                                    | eventHandlers                                                                           |
| eventHandlers          | disableSwipe                                  | ui                                                                                      |
| eventHandlers          | enableSwipe                                   | ui                                                                                      |
| eventHandlers          | keyboardShortcuts.debouncedKeyboardHandler    | (added/removed as event listener in multiple places)                                    |
| game                   | imageManagement.loadImages                    | gameSetup                                                                               |
| game                   | dialogHandling.showInfoDialog                 | eventHandlers                                                                           |
| game                   | setState                                      | gameLogic, gameSetup                                                                    |
| game                   | currentObservationURLs                        | gameLogic                                                                               |
| gameLogic              | checkAnswer                                   | dragAndDrop                                                                             |
| gameLogic              | loadNewRandomPair                             | eventHandlers                                                                           |
| gameLogic              | loadSetByID                                   | eventHandlers                                                                           |
| gameLogic              | filterTaxonPairs                              | eventHandlers, rangeSelector, tagCloud, ui                                              |
| gameLogic              | getCurrentTaxon                               | game                                                                                    |
| gameLogic              | isCurrentPairInCollection                     | gameLogic                                                                               |
| gameLogic              | loadRandomPairFromCurrentCollection           | eventHandlers, gameLogic                                                                |
| gameLogic              | selectRandomPairFromCurrentCollection         | gameLogic, preloader                                                                    |
| gameLogic              | applyFilters                                  | tagCloud                                                                                |
| gameSetup              | setupGame                                     | dialogManager, eventHandlers, functions, gameLogic, ui                                  |
| gameSetup              | setupGameWithPreloadedPair                    | gameLogic                                                                               |
| gameState              | (various state properties)                    | Most modules access gameState                                                           |
| gameState              | (various properties)                          | accessed and modified throughout the codebase                                           |
| gameUI                 | imageHandling.prepareImagesForLoading         | game, gameSetup                                                                         |
| gameUI                 | layoutManagement.setNamePairHeight            | gameSetup                                                                               |
| gameUI                 | nameTiles.setupNameTilesUI                    | gameSetup                                                                               |
| logger                 | debug, error, warn, info                      | (used throughout the codebase)                                                          |
| preloader              | pairPreloader.getPreloadedImagesForNextPair   | gameLogic, gameSetup                                                                    |
| preloader              | roundPreloader.getPreloadedImagesForNextRound | gameSetup                                                                               |
| preloader              | imageLoader.fetchDifferentImage               | game, gameSetup                                                                         |
| preloader              | pairPreloader.isPairValid                     | gameSetup                                                                               |
| preloader              | pairPreloader.hasPreloadedPair                | gameSetup                                                                               |
| preloader              | startPreloading                               | gameSetup                                                                               |
| preloader              | pairPreloader.preloadNewPairWithTags          | tagCloud                                                                                |
| preloader              | pairPreloader.preloadSetByID                  | gameLogic                                                                               |
| preloader              | roundPreloader.preloadForNextRound            | gameLogic                                                                               |
| preloader              | pairPreloader.preloadForNextPair              | gameLogic                                                                               |
| rangeSelector          | openRangeDialog                               | eventHandlers                                                                           |
| rangeSelector          | getSelectedRanges                             | tagCloud                                                                                |
| rangeSelector          | setSelectedRanges                             | functions                                                                               |
| setManager             | getSetByID                                    | gameLogic                                                                               |
| setManager             | initializeSubset                              | setManager                                                                              |
| setManager             | refreshSubset                                 | gameSetup                                                                               |
| tagCloud               | tagSelection.setSelectedTags                  | functions                                                                               |
| tagCloud               | initialization.initialize                     | functions                                                                               |
| tagCloud               | dataManager.updateFilteredPairs               | tagCloud                                                                                |
| tagCloud               | tagSelection.getSelectedTags                  | tagCloud                                                                                |
| tagCloud               | uiManager.updateMatchingPairsCount            | tagCloud                                                                                |
| tagCloud               | closeTagCloud                                 | eventHandlers                                                                           |
| tagCloud               | openTagCloud                                  | eventHandlers                                                                           |
| tagCloud               | updateTaxonList                               | rangeSelector                                                                           |
| taxaRelationshipViewer | graphManagement.showTaxaRelationship          | eventHandlers                                                                           |
| TaxonomyHierarchy      | getTaxonById                                  | taxaRelationshipViewer                                                                  |
| testingDialog          | openDialog                                    | eventHandlers                                                                           |
| ui                     | overlay.showOverlay                           | game, gameLogic, gameSetup                                                              |
| ui                     | overlay.hideOverlay                           | game, gameSetup                                                                         |
| ui                     | taxonPairList.showTaxonPairList               | eventHandlers                                                                           |
| ui                     | taxonPairList.updateFilterSummary             | dialogManager, eventHandlers, rangeSelector, tagCloud                                   |
| ui                     | levelIndicator.updateLevelIndicator           | gameLogic, gameSetup                                                                    |
| ui                     | core.initialize                               | functions                                                                               |
| ui                     | menu.initialize                               | ui                                                                                      |
| ui                     | tutorial.isActive                             | eventHandlers                                                                           |
| ui                     | tutorial.endTutorial                          | ui                                                                                      |
| ui                     | notifications.showPopupNotification           | dialogManager                                                                           |
| ui                     | filters.updateLevelDropdown                   | functions, gameLogic                                                                    |
| ui                     | menu.close                                    | eventHandlers                                                                           |
| ui                     | menu.toggleMainMenu                           | eventHandlers                                                                           |
| ui                     | tutorial.showTutorial                         | eventHandlers                                                                           |
| ui                     | core.resetUIState                             | gameSetup                                                                               |
| ui                     | taxonPairList.updateTaxonPairList             | eventHandlers, rangeSelector                                                            |
| ui                     | taxonPairList.updateActiveCollectionCount     | tagCloud, ui                                                                            |
| updateGameState        | (function)                                    | game, gameLogic, gameSetup, preloader, rangeSelector, tagCloud                          |
| utils                  | url.getURLParameters                          | functions                                                                               |
| utils                  | game.selectTaxonPair                          | game                                                                                    |
| utils                  | game.resetDraggables                          | gameLogic, gameSetup                                                                    |
| utils                  | ui.sleep                                      | game, gameLogic                                                                         |
| utils                  | ui.sleep                                      | gameLogic                                                                               |
| utils                  | game.getFilteredTaxonPairs                    | utils                                                                                   |
| utils                  | string.capitalizeFirstLetter                  | gameSetup, taxaRelationshipViewer                                                       |
| utils                  | string.shortenSpeciesName                     | taxaRelationshipViewer                                                                  |
| utils                  | ui.debounce                                   | eventHandlers                                                                           |
| utils                  | device.hasKeyboard                            | dialogManager                                                                           |
| utils                  | url.shareCurrentPair                          | eventHandlers                                                                           |
| worldMap               | createWorldMap                                | gameSetup                                                                               |
| worldMap               | getFullContinentName                          | rangeSelector, ui                                                                       |
| worldMap               | toggleAllWorldMaps                            | worldMap                                                                                |
| worldMap               | createClickableWorldMap                       | rangeSelector                                                                           |
| worldMap               | createNonClickableWorldMap                    | ui                                                                                      |
| worldMap               | getContinentAbbreviation                      | rangeSelector                                                                           |

