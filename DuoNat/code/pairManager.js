import api from './api.js';
import filtering from './filtering.js';
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
                logger.debug('Collection subset initialization already in progress, skipping');
                return;
            }
            this.isInitialized = true;
            logger.debug('Initializing collection subset');
            try {
                const allPairs = await api.taxonomy.fetchTaxonPairs();
                const filters = filtering.getActiveFilters();
                pairManager.allFilteredPairs = filtering.filterTaxonPairs(allPairs, filters);
                
                logger.debug(`Total filtered pairs in collection: ${pairManager.allFilteredPairs.length}`);

                const subsetSize = Math.min(42, pairManager.allFilteredPairs.length);

                // Filter out the last used pair when creating a new subset
                const availablePairs = pairManager.allFilteredPairs.filter(pair => pair.pairID !== this.lastUsedPairID);
                pairManager.currentCollectionSubset = pairManager.utilities.getRandomSubset(availablePairs, subsetSize);
                logger.debug(`Initialized new collection subset of pairs: ${pairManager.currentCollectionSubset.length}`);
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
                logger.debug('Using next selected pair:', nextSelectedPair);
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
                    logger.debug("Selected random pair from filtered collection");
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
                if (urlParams.taxon1 && urlParams.taxon2) { // not saved in gameState atm
                return this.findPairByTaxa(filteredPairs, urlParams.taxon1, urlParams.taxon2);
                }
            }
            return null;
        },

        findPairByTaxa(filteredPairs, taxon1, taxon2) {
            const pair = filteredPairs.find(pair =>
                (pair.taxonNames[0] === taxon1 && pair.taxonNames[1] === taxon2) ||
                (pair.taxonNames[0] === taxon2 && pair.taxonNames[1] === taxon1)
            );
            if (pair) {
                logger.debug(`Found pair with taxa: ${taxon1} and ${taxon2}`);
            } else {
                logger.warn(`Taxa ${taxon1} and ${taxon2} not found in filtered collection. Selecting random pair.`);
            }
            return pair;
        },

        findPairByPairID(filteredPairs, pairID) {
            const pair = filteredPairs.find(pair => pair.pairID === pairID);
            if (pair) {
                logger.debug(`Found pair with pairID: ${pairID}`);
            } else {
                logger.warn(`PairID ${pairID} not found in filtered collection. Selecting random pair.`);
            }
            return pair;
        },

        async selectRandomPairFromCurrentCollection() {
            // First, try to get the next pair from the pairManager
            const nextPair = await this.getNextPairFromCollection();
            
            if (nextPair) {
                logger.debug(`Selected pair from pairManager: ${nextPair.taxonNames[0]} / ${nextPair.taxonNames[1]}`);
                return nextPair;
            }
            
            // If pairManager doesn't return a pair, fall back to the original method
            logger.debug("No pair available from pairManager, falling back to original method");
            const filters = filtering.getActiveFilters();
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            const filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);
            
            if (filteredPairs.length === 0) {
                throw new Error("No pairs available in the current collection");
            }
            
            const randomIndex = Math.floor(Math.random() * filteredPairs.length);
            const selectedPair = filteredPairs[randomIndex];
            
            logger.debug(`Selected pair from fallback: ${selectedPair.taxonNames[0]} / ${selectedPair.taxonNames[1]}`);
            
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
                logger.debug(`Next pair: ${nextPair.pairID}, Remaining pairs in subset: ${pairManager.currentCollectionSubset.length}, Total pairs in collection: ${pairManager.allFilteredPairs.length}`);

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
            const images = await pairManager.imageHandling.loadImagesForNewPair(newPair);
            pairManager.stateManagement.updateGameStateForNewPair(newPair, images);
            await roundManager.setupRoundFromGameSetup(true);
        },

        loadNewPair() {
            try {
                this.loadNewRandomPair();
            } catch (error) {
                logger.error("Error loading new pair:", error);
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
            await roundManager.loadNewRound(true);

            if (state.getState() !== state.GameState.PLAYING) {
                await this.fallbackPairLoading(usePreloadedPair);
            }

            const newPair = state.getCurrentTaxonImageCollection().pair;
            pairManager.uiHandling.updateUIForNewPair(newPair);
        },

        async fallbackPairLoading(usePreloadedPair) {
            let newPair;
            if (usePreloadedPair) {
                newPair = await this.loadPreloadedPair();
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
                await gameSetup.setupGame(true);
                return newPair;
            }
            throw new Error("No pairs available in the current collection");
        },

        async loadPreloadedPair() {
            const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
            if (preloadedImages && preloadedImages.pair && filtering.isPairValidForCurrentFilters(preloadedImages.pair)) {
                await gameSetup.setupGameWithPreloadedPair(preloadedImages);
                return preloadedImages.pair;
            }
            return null;
        },

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
            await gameSetup.setupGame(true);
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
                return { pair: await this.getNextPairFromCollection(), preloadedImages: null };
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
    },

    imageHandling: {
        async loadImagesForNewPair(newPair) {
            const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
            if (preloadedImages && preloadedImages.pair.pairID === newPair.pairID) {
                logger.debug(`Using preloaded images for pair ID ${newPair.pairID}`);
                return preloadedImages;
            }
            return {
                taxon1: await preloader.imageLoader.fetchDifferentImage(newPair.taxon1 || newPair.taxonNames[0], null),
                taxon2: await preloader.imageLoader.fetchDifferentImage(newPair.taxon2 || newPair.taxonNames[1], null),
            };
        },
    },

    stateManagement: {
        updateGameStateForNewPair(newPair, images) {
            state.updateGameStateMultiple({
                currentTaxonImageCollection: {
                    pair: newPair,
                    imageOneURL: images.taxon1,
                    imageTwoURL: images.taxon2,
                    level: newPair.level || '1',
                },
                usedImages: {
                    taxon1: new Set([images.taxon1]),
                    taxon2: new Set([images.taxon2]),
                },
            });
            state.setCurrentPairID(newPair.pairID || state.getCurrentPairID());
            ui.updateLevelIndicator(newPair.level || '1');
        },
    },

    uiHandling: {
        prepareForNewPair() {
            state.setState(state.GameState.LOADING);
            ui.prepareImagesForLoading();
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
    loadNewPair: pairManager.pairLoading.loadNewRandomPair,
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
