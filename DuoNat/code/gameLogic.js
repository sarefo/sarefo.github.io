import api from './api.js';
import config from './config.js';
import game from './game.js'; // TODO move loadingMessage to config, then remove
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

            if (leftAnswer || rightAnswer) {
                let isCorrect = false;
                if (droppedZoneId === 'drop-1') {
                    isCorrect = leftAnswer === state.getTaxonImageOne;
                } else {
                    isCorrect = rightAnswer === state.getTaxonImageTwo;
                }

                if (isCorrect) {
                    gameLogic.answerHandling.handleCorrectAnswer();
                } else {
                    gameLogic.answerHandling.handleIncorrectAnswer();
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
            ui.updateOverlayMessage(`${game.getLoadingMessage()}`); // Update message without changing color
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
    async loadNewRandomPair() {
        state.setState(state.GameState.LOADING);
        ui.showOverlay(`${game.getLoadingMessage()}`, config.overlayColors.green);
        gameUI.prepareImagesForLoading();

        try {
            let newPair;
            const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();

            if (preloadedImages && preloadedImages.pair && gameLogic.pairManagement.isPairValidForCurrentFilters(preloadedImages.pair)) {
                newPair = preloadedImages.pair;
                await gameSetup.setupGameWithPreloadedPair(preloadedImages);
            } else {
                newPair = await this.selectRandomPairFromCurrentCollection();
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
            let selectedLevel = state.getSelectedLevel();
            let selectedTags = state.getSelectedTags();
            let selectedRanges = state.getSelectedRanges();
            const matchesLevel = selectedLevel === '' || pair.level === selectedLevel;
            const matchesTags = selectedTags.length === 0 ||
                selectedTags.every(tag => pair.tags.includes(tag));
            const matchesRanges = selectedRanges.length === 0 ||
                (pair.range && pair.range.some(range => selectedRanges.includes(range)));

            return matchesLevel && matchesTags && matchesRanges;
        },

        selectRandomPairFromCurrentCollection: async function () {
            const taxonSets = await api.taxonomy.fetchTaxonPairs();
            const filteredSets = gameLogic.filterHandling.filterTaxonPairs(taxonSets, {
                level: state.getSelectedLevel(),
                ranges: state.getSelectedRanges(),
                tags: state.getSelectedTags()
            });
            
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
                    ui.updateFilterSummary();
                    ui.updateLevelDropdown();
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
    
    filterHandling: {
        filterTaxonPairs: function (taxonPairs, filters) {
            return taxonPairs.filter(pair => {
                const matchesLevel = filters.level === '' || pair.level === filters.level;
                const matchesRanges = !filters.ranges || filters.ranges.length === 0 ||
                    (pair.range && pair.range.some(range => filters.ranges.includes(range)));
                const matchesTags = filters.tags.length === 0 ||
                    filters.tags.every(tag => pair.tags.includes(tag)); // Changed from 'some' to 'every'

                return matchesLevel && matchesRanges && matchesTags;
            });
        },

        applyFilters: function (newFilters) {
            state.updateGameStateMultiple({
                selectedLevel: newFilters.level ?? state.getSelectedLevel(),
                selectedRanges: newFilters.ranges ?? state.getSelectedRanges(),
                selectedTags: newFilters.tags ?? state.getSelectedTags()
            });

            const currentPair = state.getCurrentTaxonImageCollection().pair;
            if (!gameLogic.pairManagement.isPairValidForCurrentFilters(currentPair)) {
                gameLogic.pairManagement.loadNewRandomPair();
            } else {
                preloader.pairPreloader.preloadForNextPair();
            }
            ui.updateFilterSummary();
        },
    },
    
    taxonHandling: {
        getCurrentTaxon(url) {
            let currentObservationURLs = state.getObservationURLs();
            if (url === currentObservationURLs.imageOne) {
                return state.getTaxonImageOne();
            } else if (url === currentObservationURLs.imageTwo) {
                return state.getTaxonImageTwo();
            } else {
                logger.error("Unable to determine current taxon name");
                return null;
            }
        },
    },

    collectionManagement: {
        async loadRandomPairFromCurrentCollection() {
            logger.debug(`Loading pair. Selected level: ${state.getSelectedLevel()}`);

            if (gameLogic.collectionManagement.isCurrentPairInCollection()) {
                logger.debug("Current pair is in collection. No new pair loaded.");
                return;
            }

            try {
                const newPair = await gameLogic.pairManagement.selectRandomPairFromCurrentCollection();
                if (newPair) {
                    logger.debug(`New pair selected: ${newPair.taxon1} / ${newPair.taxon2}, Level: ${newPair.level}`);
                    state.setNextSelectedPair(newPair);
                    await gameSetup.setupGame(true);
                } else {
                    throw new Error("No pairs available in the current collection");
                }
            } catch (error) {
                logger.error("Error loading random pair:", error);
                ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
            } finally {
                state.setState(state.GameState.PLAYING);
                preloader.roundPreloader.clearPreloadedImagesForNextRound();
                preloader.roundPreloader.preloadForNextRound();
                preloader.pairPreloader.preloadForNextPair();
            }
        },

        isCurrentPairInCollection() {
            let currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
            if (!currentTaxonImageCollection || !currentTaxonImageCollection.pair) {
                return false;
            }

            const currentPair = currentTaxonImageCollection.pair;
            const selectedLevel = state.getSelectedLevel();

            const matchesLevel = selectedLevel === '' || currentPair.level === selectedLevel;

            if (!matchesLevel) {
                logger.debug(`Current pair not in collection - Skill level mismatch: Pair ${currentPair.level}, Selected ${selectedLevel}`);
            }

            return matchesLevel; // Simplified for now to focus on skill level
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
    // Game
    checkAnswer: gameLogic.answerHandling.checkAnswer,
    // Filters
    // this function is very popular for some reason… too popular ;)
    filterTaxonPairs: gameLogic.filterHandling.filterTaxonPairs,
    applyFilters: gameLogic.filterHandling.applyFilters,
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
