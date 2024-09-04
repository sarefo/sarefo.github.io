import api from './api.js';
import errorHandling from './errorHandling.js';
import filtering from './filtering.js';
import gameSetup from './gameSetup.js'; // TODO remove after streamlining
import logger from './logger.js';
import preloader from './preloader.js';
import roundManager from './roundManager.js';
import state from './state.js';
import ui from './ui.js';
import url from './url.js';

const pairManager = {
    currentCollectionSubset: [],
    allFilteredPairs: [],
    usedPairIDs: new Set(),
    lastUsedPairID: null,
    isInitialized: false,

    initialization: {
        async initializeCollectionSubset() {
            if (this.isInitializing) {
                logger.warn('Collection subset initialization already in progress, skipping');
                return;
            }
            this.isInitialized = true;
            try {
                const allPairs = await api.taxonomy.fetchTaxonPairs();
                const filters = filtering.getActiveFilters();
                pairManager.allFilteredPairs = filtering.filterTaxonPairs(allPairs, filters);
                
                const subsetSize = Math.min(42, pairManager.allFilteredPairs.length);

                // Filter out the last used pair when creating a new subset
                const availablePairs = pairManager.allFilteredPairs.filter(pair => pair.pairID !== this.lastUsedPairID);
                pairManager.currentCollectionSubset = pairManager.utilities.getRandomSubset(availablePairs, subsetSize);
                //logger.debug(`Initialized new collection subset of pairs: ${pairManager.currentCollectionSubset.length}`);
            } finally {
                this.isInitializing = false;
            }
        },

        async refreshCollectionSubset() {
            pairManager.isInitialized = false;
            pairManager.usedPairIDs.clear();
            pairManager.lastUsedPairID = null;
            preloader.pairPreloader.isCollectionSubsetInitialized = false;
            await this.initializeCollectionSubset();
        },
    },

    pairSelection: {
        async selectNewPair() {
            state.resetShownHints();
            let nextSelectedPair = state.getNextSelectedPair();
            if (nextSelectedPair) {
                state.setNextSelectedPair(null);
                //logger.debug('Using next selected pair:', nextSelectedPair);
                return nextSelectedPair;
            }
            return await this.selectPairFromFilters();
        },

        async selectPairFromFilters() {
            const filters = filtering.getActiveFilters();
            const filteredPairs = await filtering.getFilteredTaxonPairs(filters);
            return this.findOrSelectRandomPair(filteredPairs);
        },

        findOrSelectRandomPair(filteredPairs) {
            let pair = this.findPairByUrlParams(filteredPairs);
            if (!pair) {
                if (filteredPairs.length > 0) {
                    pair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
                    //logger.debug("Selected random pair from filtered collection");
                } else {
                    throw new Error("No pairs available in the current filtered collection");
                }
            }
            return pair;
        },

        findPairByUrlParams(filteredPairs) {
            const pairID = state.getCurrentPairID();
            if (pairID) {
                return this.findPairByPairID(filteredPairs, pairID);
            } else {
                const urlParams = url.getUrlParameters();
                if (urlParams.taxonA && urlParams.taxonB) { // not saved in gameState atm
                return this.findPairByTaxa(filteredPairs, urlParams.taxonA, urlParams.taxonB);
                }
            }
            return null;
        },

        findPairByTaxa(filteredPairs, taxonA, taxonB) {
            const pair = filteredPairs.find(pair =>
                (pair.taxonNames[0] === taxonA && pair.taxonNames[1] === taxonB) ||
                (pair.taxonNames[0] === taxonB && pair.taxonNames[1] === taxonA)
            );
            if (pair) {
                //logger.debug(`Found pair with taxa: ${taxonA} and ${taxonB}`);
            } else {
                logger.warn(`Taxa ${taxonA} and ${taxonB} not found in filtered collection. Selecting random pair.`);
            }
            return pair;
        },

        findPairByPairID(filteredPairs, pairID) {
            const pair = filteredPairs.find(pair => pair.pairID === pairID);
            if (pair) {
                //logger.debug(`Found pair with pairID: ${pairID}`);
            } else {
                logger.warn(`PairID ${pairID} not found in filtered collection. Selecting random pair.`);
            }
            return pair;
        },

        async selectRandomPairFromCurrentCollection() {
            // First, try to get the next pair from the pairManager
            const nextPair = await this.getNextPairFromCollection();
            
            if (nextPair) {
                //logger.debug(`Selected pair from pairManager: ${nextPair.taxonNames[0]} / ${nextPair.taxonNames[1]}`);
                return nextPair;
            }
            
            // If pairManager doesn't return a pair, fall back to the original method
            logger.warn("No pair available from pairManager, falling back to original method");
            const filters = filtering.getActiveFilters();
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            const filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);
            
            if (filteredPairs.length === 0) {
                throw new Error("No pairs available in the current collection");
            }
            
            const randomIndex = Math.floor(Math.random() * filteredPairs.length);
            const selectedPair = filteredPairs[randomIndex];
            
            //logger.debug(`Selected pair from fallback: ${selectedPair.taxonNames[0]} / ${selectedPair.taxonNames[1]}`);
            
            // Inform pairManager about this selection
            pairManager.usedPairIDs.add(selectedPair.pairID);
            
            return selectedPair;
        },

        async getNextPairFromCollection() {
            if (!pairManager.isInitialized || pairManager.currentCollectionSubset.length === 0) {
                await pairManager.initialization.initializeCollectionSubset();
            }

            let nextPair;
            do {
                if (pairManager.currentCollectionSubset.length === 0) {
                    await pairManager.initialization.initializeCollectionSubset();
                }
                nextPair = pairManager.currentCollectionSubset.pop();
            } while (nextPair && pairManager.usedPairIDs.has(nextPair.pairID));

            if (nextPair) {
                pairManager.usedPairIDs.add(nextPair.pairID);
                pairManager.lastUsedPairID = nextPair.pairID;
                //logger.debug(`Next pair: ${nextPair.pairID}, Remaining pairs in subset: ${pairManager.currentCollectionSubset.length}, Total pairs in collection: ${pairManager.allFilteredPairs.length}`);

                // Reset usedPairIDs if all pairs have been used
                if (pairManager.usedPairIDs.size === pairManager.allFilteredPairs.length) {
                    pairManager.usedPairIDs.clear();
                    pairManager.usedPairIDs.add(nextPair.pairID);  // Keep the current pair in usedPairIDs
                }
            } else {
                logger.warn('No next pair available, this should not happen');
            }

            return nextPair;
        },
    },

    pairLoading: {
        async initializeNewPair() {
            const newPair = await pairManager.pairSelection.selectNewPair();
            //logger.debug(`Initializing new pair: ${newPair.taxonA} / ${newPair.taxonB}`);
            pairManager.pairManagement.resetUsedImagesForNewPair(newPair);
            const images = await pairManager.imageHandling.loadImagesForNewPair(newPair);
            //logger.debug(`Loaded images for new pair: ${images.taxonA} / ${images.taxonB}`);
            pairManager.stateManagement.updateGameStateForNewPair(newPair, images);
            await roundManager.setupRoundFromGameSetup(true);
        },

        async TODOloadNewPair () {
        //async TODOloadNewPair (pairID = null) {
            logger.debug("loadNewPair");
            state.setState(state.GameState.LOADING);

            /*if (pairID == null) {
                this.loadNewRandomPair(); // TODO eliminate
            }*/

            //await gameSetup.setupGame(true);
            try {
                await gameSetup.setupPairOrRound(true);
            } catch (error) {
                errorHandling.handleSetupError(error);
            } finally {
                state.setState(state.GameState.PLAYING);
            }
            
        },

        async loadNewRandomPair(usePreloadedPair = true) {
            pairManager.uiHandling.prepareForNewPair();

            try {
                await this.attemptToLoadNewPair(usePreloadedPair);
            } catch (error) {
                pairManager.errorHandling.handlePairLoadingError(error);
            } finally {
                pairManager.utilities.finalizePairLoading();
            }
        },

        // TODO FIX maybe should not call roundManager
        async attemptToLoadNewPair(usePreloadedPair) {
            await roundManager.OLDloadNewRound(true);

            if (state.getState() !== state.GameState.PLAYING) {
                await this.fallbackPairLoading(usePreloadedPair);
            }

            const newPair = state.getCurrentTaxonImageCollection().pair;
            pairManager.uiHandling.updateUIForNewPair(newPair);
        },

        async fallbackPairLoading(usePreloadedPair) {
            let newPair;
            if (usePreloadedPair) {
                //newPair = await this.loadPreloadedPair();
                logger.error("turns out we need loadPreloadedPair() after all :P");
            }
            if (!newPair) {
                newPair = await this.selectAndSetupRandomPair();
            }
            return newPair;
        },

        async selectAndSetupRandomPair() {
            const newPair = await pairManager.pairSelection.selectRandomPairFromCurrentCollection();
            if (newPair) {
                state.setNextSelectedPair(newPair);
                //await gameSetup.setupGame(true);
                await this.loadNewPair();
                return newPair;
            }
            throw new Error("No pairs available in the current collection");
        },

        /*async loadPreloadedPair() {
            logger.warn("loadPreloadedPair");
            const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
            if (preloadedImages && preloadedImages.pair && filtering.isPairValidForCurrentFilters(preloadedImages.pair)) {
                await gameSetup.setupGame(false);  // Changed from setupGameWithPreloadedPair
                return preloadedImages.pair;
            }
            return null;
        },*/


        async loadPairByID(pairID, clearFilters = false) {
            try {
                if (clearFilters) {
                    filtering.clearAllFilters();
                }

                const newPair = await pairManager.getPairByID(pairID);
                if (newPair) {
                    await this.setupNewPair(newPair, pairID);
                } else {
                    logger.warn(`Pair with ID ${pairID} not found.`);
                }
            } catch (error) {
                logger.error(`Error loading pair with ID ${pairID}:`, error);
            }
        },

        async setupNewPair(newPair, pairID) {
            state.setNextSelectedPair(newPair);
            //await gameSetup.setupGame(true);
            await this.loadNewPair();
            const nextPairID = String(Number(pairID) + 1);
            preloader.pairPreloader.preloadPairByID(nextPairID);
        },
    },

    pairManagement: {
        async getNextPair(isNewPair) {
            if (isNewPair) {
                const preloadedPair = preloader.pairPreloader.getPreloadedImagesForNextPair();
                if (preloadedPair && preloadedPair.pair && pairManager.pairManagement.isPairValid(preloadedPair.pair)) {
                    return { pair: preloadedPair.pair, preloadedImages: preloadedPair };
                }
                return { pair: await pairManager.pairSelection.getNextPairFromCollection(), preloadedImages: null };
            }
            return { pair: state.getCurrentTaxonImageCollection().pair, preloadedImages: null };
        },

        isPairValid(pair) {
            const filters = filtering.getActiveFilters();
            return filtering.pairMatchesFilters(pair, filters);
        },

        isPairUsed(pairID) {
            return pairManager.usedPairIDs.has(pairID);
        },

        async getPairByID(pairID) {
            const allPairs = await api.taxonomy.fetchTaxonPairs();
            return allPairs.find(pair => pair.pairID === pairID);
        },

        resetUsedImagesForNewPair(newPair) {
            const currentUsedImages = state.getUsedImages();
            const updatedUsedImages = { ...currentUsedImages };
            delete updatedUsedImages[newPair.taxonA];
            delete updatedUsedImages[newPair.taxonB];
            state.updateGameStateMultiple({
                usedImages: updatedUsedImages
            });
            //logger.debug(`Reset used images for new pair: ${newPair.taxonA} and ${newPair.taxonB}`);
        },
    },

    imageHandling: {
        async loadImagesForNewPair(newPair) {
            const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
            //logger.debug(`Attempting to load images for new pair: ${newPair.taxonA} / ${newPair.taxonB}`);
            //logger.debug(`Preloaded images available: ${!!preloadedImages}`);
            
            if (preloadedImages && preloadedImages.pair.pairID === newPair.pairID) {
                //logger.debug(`Using preloaded images for pair ID ${newPair.pairID}`);
                return preloadedImages;
            }
            
            //logger.debug(`Fetching new images for pair ID ${newPair.pairID}`);
            const taxonAImage = await preloader.imageLoader.fetchDifferentImage(newPair.taxonA || newPair.taxonNames[0], null);
            const taxonBImage = await preloader.imageLoader.fetchDifferentImage(newPair.taxonB || newPair.taxonNames[1], null);
            
            //logger.debug(`Fetched images: ${taxonAImage} / ${taxonBImage}`);
            
            return {
                taxonA: taxonAImage,
                taxonB: taxonBImage,
            };
        },
    },

    stateManagement: {
        updateGameStateForNewPair(newPair, images) {
            state.updateGameStateMultiple({
                currentTaxonImageCollection: {
                    pair: newPair,
                    image1URL: images.taxonA,
                    image2URL: images.taxonB,
                    level: newPair.level || '1',
                },
                usedImages: {
                    taxonA: new Set([images.taxonA]),
                    taxonB: new Set([images.taxonB]),
                },
            });
            state.setCurrentPairID(newPair.pairID || state.getCurrentPairID());
            ui.updateLevelIndicator(newPair.level || '1');
        },
    },

    uiHandling: {
        // TODO this looks like round code
        prepareForNewPair() {
            state.setState(state.GameState.LOADING);
            roundManager.prepareImagesForLoading();
            preloader.roundPreloader.clearPreloadedImagesForNextRound();
        },

        updateUIForNewPair(newPair) {
            ui.hideOverlay();
            if (newPair) {
                ui.updateLevelIndicator(newPair.level);
            }
        },
    },

    errorHandling: {
        handlePairLoadingError(error) {
            logger.error("Error loading new pair:", error);
            ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
        },
    },

    utilities: {
        getRandomSubset(array, size) {
            const shuffled = [...array];
            this.shuffleArray(shuffled);
            return shuffled.slice(0, size);
        },

        shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        },

        finalizePairLoading() {
            if (state.getState() !== state.GameState.PLAYING) {
                state.setState(state.GameState.PLAYING);
            }
            preloader.startPreloading(true);
        },
    },
};

// Bind all methods in pairManager and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};

bindMethodsRecursively(pairManager);

const publicAPI = {
    initializeNewPair: pairManager.pairLoading.initializeNewPair,
    initializeCollectionSubset: pairManager.initialization.initializeCollectionSubset,
    getNextPair: pairManager.pairManagement.getNextPair,
    //getNextPairFromCollection: pairManager.pairSelection.getNextPairFromCollection,
    //loadNewPair: pairManager.pairLoading.loadNewPair,
    loadNewPair: pairManager.pairLoading.TODOloadNewPair,
    loadNewRandomPair: pairManager.pairLoading.loadNewRandomPair,
    refreshCollectionSubset: pairManager.initialization.refreshCollectionSubset,
    selectNewPair: pairManager.pairSelection.selectNewPair,
    getPairByID: pairManager.pairManagement.getPairByID,
    loadPairByID: pairManager.pairLoading.loadPairByID,
    selectRandomPairFromCurrentCollection: pairManager.pairSelection.selectRandomPairFromCurrentCollection,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(pairManager);
    }
});

export default publicAPI;
