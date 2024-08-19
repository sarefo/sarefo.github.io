import api from './api.js';
import collectionManager from './config.js';
import config from './config.js';
import filtering from './filtering.js';
import gameSetup from './gameSetup.js';
import gameUI from './gameUI.js';
import logger from './logger.js';
import preloader from './preloader.js';
import setManager from './setManager.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';

const gameLogic = {
    answerHandling: {

        checkAnswer(droppedZoneId) {
            const currentState = state.getState();
            if (currentState !== state.GameState.PLAYING) {
                logger.debug(`Cannot check answer when not in PLAYING state. Current state: ${currentState}`);
                return;
            }

            state.setState(state.GameState.CHECKING);

            const dropOne = document.getElementById('drop-1');
            const dropTwo = document.getElementById('drop-2');

            const leftAnswer = dropOne.children[0]?.getAttribute('data-taxon');
            const rightAnswer = dropTwo.children[0]?.getAttribute('data-taxon');

            if (leftAnswer && rightAnswer) {
                const isCorrect =
                    leftAnswer === state.getTaxonImageOne() &&
                    rightAnswer === state.getTaxonImageTwo();

                if (isCorrect) {
                    this.answerHandling.handleCorrectAnswer();
                } else {
                    this.answerHandling.handleIncorrectAnswer();
                }
            } else {
                logger.debug("Incomplete answer. Returning to PLAYING state.");
                state.setState(state.GameState.PLAYING);
            }
        },

        async handleCorrectAnswer() {
            await ui.showOverlay('Correct!', config.overlayColors.green);
            gameUI.prepareImagesForLoading();
            await utils.ui.sleep(2000); // Show "Correct!" for a while
            ui.updateOverlayMessage(`${utils.ui.getLoadingMessage()}`); // Update message without changing color
            await gameSetup.setupGame(false);  // Start a new round with the same taxon pair
        },

        async handleIncorrectAnswer() {
            utils.game.resetDraggables();
            await ui.showOverlay('Try again!', config.overlayColors.red);
            await utils.ui.sleep(1200);
            ui.hideOverlay();
            state.setState(state.GameState.PLAYING);
        },
    },

    pairManagement: {
        async loadNewRandomPair(usePreloadedPair = true) {
            state.setState(state.GameState.LOADING);
            ui.showOverlay(`${utils.ui.getLoadingMessage()}`, config.overlayColors.green);
            gameUI.prepareImagesForLoading();

            try {
                let newPair;
                if (usePreloadedPair) {
                    const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
                    if (preloadedImages && preloadedImages.pair && gameLogic.pairManagement.isPairValidForCurrentFilters(preloadedImages.pair)) {
                        newPair = preloadedImages.pair;
                        await gameSetup.setupGameWithPreloadedPair(preloadedImages);
                    }
                }

                if (!newPair) {
                    newPair = await gameLogic.pairManagement.selectRandomPairFromCurrentCollection();
                    if (newPair) {
                        state.setNextSelectedPair(newPair);
                        await gameSetup.setupGame(true);
                    } else {
                        throw new Error("No pairs available in the current collection");
                    }
                }

                ui.hideOverlay();
                ui.updateLevelIndicator(newPair.level);
            } catch (error) {
                logger.error("Error loading new pair:", error);
                ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
            } finally {
                state.setState(state.GameState.PLAYING);
                preloader.roundPreloader.clearPreloadedImagesForNextRound();
                preloader.roundPreloader.preloadForNextRound();
                preloader.pairPreloader.preloadForNextPair();
            }
        },

        isPairValidForCurrentFilters: function (pair) {
            if (!pair) {
                logger.warn("Received undefined pair in isPairValidForCurrentFilters");
                return false;
            }

            let selectedLevel = state.getSelectedLevel();
            let selectedTags = state.getSelectedTags();
            let selectedRanges = state.getSelectedRanges();
            let searchTerm = state.getSearchTerm();
            let phylogenyId = state.getPhylogenyId();

            const matchesLevel = selectedLevel === '' || pair.level === selectedLevel;
            const matchesTags = selectedTags.length === 0 ||
                (pair.tags && selectedTags.every(tag => pair.tags.includes(tag)));
            const matchesRanges = selectedRanges.length === 0 ||
                (pair.range && pair.range.some(range => selectedRanges.includes(range)));
            const matchesSearch = !searchTerm ||
                (pair.taxonNames && pair.taxonNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()))) ||
                (pair.setName && pair.setName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (pair.tags && pair.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));

            const matchesPhylogeny = !phylogenyId ||
                pair.taxa.some(taxonId => filtering.isDescendantOf(taxonId, phylogenyId));

            return matchesLevel && matchesTags && matchesRanges && matchesSearch;
        },

        async selectRandomPairFromCurrentCollection() {
            const filters = filtering.getActiveFilters();
            const taxonSets = await api.taxonomy.fetchTaxonPairs();
            const filteredSets = filtering.filterTaxonPairs(taxonSets, filters);

            if (filteredSets.length === 0) {
                throw new Error("No pairs available in the current collection");
            }

            const randomIndex = Math.floor(Math.random() * filteredSets.length);
            return filteredSets[randomIndex];
        },

        async loadSetByID(setID, clearFilters = false) {
            try {
                if (clearFilters) {
                    // Clear all filters
                    state.updateGameStateMultiple({
                        selectedTags: [],
                        selectedRanges: [],
                        selectedLevel: ''
                    });

                    // Update UI to reflect cleared filters
                    collectionManager.updateUIForClearedFilters();
                }

                const newPair = await setManager.getSetByID(setID);
                if (newPair) {
                    state.setNextSelectedPair(newPair);
                    await gameSetup.setupGame(true);
                    const nextSetID = String(Number(setID) + 1);
                    preloader.pairPreloader.preloadSetByID(nextSetID);
                } else {
                    logger.warn(`Set with ID ${setID} not found.`);
                }
            } catch (error) {
                logger.error(`Error loading set with ID ${setID}:`, error);
            }
        },
    },

    taxonHandling: {
        getCurrentTaxon(url) {
            let currentObservationURLs = state.getObservationURLs();
            //            logger.debug(`getCurrentTaxon called with URL: ${url}`);
            //            logger.debug(`Current observation URLs: ${JSON.stringify(currentObservationURLs)}`);

            if (url === currentObservationURLs.imageOne) {
                const taxon = state.getTaxonImageOne();
                //                logger.debug(`Matched imageOne, returning taxon: ${taxon}`);
                return taxon;
            } else if (url === currentObservationURLs.imageTwo) {
                const taxon = state.getTaxonImageTwo();
                //                logger.debug(`Matched imageTwo, returning taxon: ${taxon}`);
                return taxon;
            } else {
                logger.error(`Unable to determine current taxon name. URL: ${url} does not match any current observation URL.`);
                return null;
            }
        },
    },

    collectionManagement: {
        loadRandomPairFromCurrentCollection: async function () {
            logger.debug(`Loading pair. Selected level: ${state.getSelectedLevel()}`);

            if (gameLogic.collectionManagement.isCurrentPairInCollection()) {
                logger.debug("Current pair is in collection. Loading new random pair.");
                await gameLogic.pairManagement.loadNewRandomPair();
            } else {
                await gameLogic.pairManagement.loadNewRandomPair();
            }
        },

        loadNewPair() {
            try {
                gameLogic.pairManagement.loadNewRandomPair();
            } catch (error) {
                logger.error("Error loading new pair:", error);
            }
        },

        isCurrentPairInCollection() {
            let currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
            if (!currentTaxonImageCollection || !currentTaxonImageCollection.pair) {
                return false;
            }

            const currentPair = currentTaxonImageCollection.pair;
            return gameLogic.pairManagement.isPairValidForCurrentFilters(currentPair);
        },
    },
};

const publicAPI = {
    // Pairs
    isCurrentPairInCollection: gameLogic.collectionManagement.isCurrentPairInCollection,
    loadRandomPairFromCurrentCollection: gameLogic.collectionManagement.loadRandomPairFromCurrentCollection,
    selectRandomPairFromCurrentCollection: gameLogic.pairManagement.selectRandomPairFromCurrentCollection,
    loadNewRandomPair: gameLogic.pairManagement.loadNewRandomPair,
    loadSetByID: gameLogic.pairManagement.loadSetByID,
    loadNewPair: gameLogic.collectionManagement.loadNewPair,
    // Game
    checkAnswer: gameLogic.answerHandling.checkAnswer,
    // Misc 
    getCurrentTaxon: gameLogic.taxonHandling.getCurrentTaxon,
};

// Bind all methods in the publicAPI to ensure correct 'this' context
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(gameLogic);
    }
});

export default publicAPI;
