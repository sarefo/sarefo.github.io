import api from './api.js';
import config from './config.js';
import { gameState, updateGameState, GameState } from './state.js';
import game from './game.js';
import gameSetup from './gameSetup.js';
import gameUI from './gameUI.js';
import logger from './logger.js';
import preloader from './preloader.js';
import setManager from './setManager.js';
import ui from './ui.js';
import utils from './utils.js';

const gameLogic = {
    answerHandling: {

        checkAnswer(droppedZoneId) {
            if (game.getState() !== GameState.PLAYING) {
                logger.debug("Cannot check answer when not in PLAYING state");
                return;
            }

            game.setState(GameState.CHECKING);

            const dropOne = document.getElementById('drop-1');
            const dropTwo = document.getElementById('drop-2');

            const leftAnswer = dropOne.children[0]?.getAttribute('data-taxon');
            const rightAnswer = dropTwo.children[0]?.getAttribute('data-taxon');

            if (leftAnswer || rightAnswer) {
                let isCorrect = false;
                if (droppedZoneId === 'drop-1') {
                    isCorrect = leftAnswer === gameState.taxonImageOne;
                } else {
                    isCorrect = rightAnswer === gameState.taxonImageTwo;
                }

                if (isCorrect) {
                    gameLogic.answerHandling.handleCorrectAnswer();
                } else {
                    gameLogic.answerHandling.handleIncorrectAnswer();
                }
            } else {
                logger.debug("Incomplete answer. Returning to PLAYING state.");
                game.setState(GameState.PLAYING);
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
            game.setState(GameState.PLAYING);
        },
    },
    
    pairManagement: {
    async loadNewRandomPair() {
        game.setState(GameState.LOADING);
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
                    game.setNextSelectedPair(newPair);
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
            game.setState(GameState.PLAYING);
            preloader.roundPreloader.clearPreloadedImagesForNextRound();
            preloader.roundPreloader.preloadForNextRound();
            preloader.pairPreloader.preloadForNextPair();
        }
    },
  
        isPairValidForCurrentFilters: function (pair) {
            const matchesLevel = gameState.selectedLevel === '' || pair.level === gameState.selectedLevel;
            const matchesTags = gameState.selectedTags.length === 0 ||
                gameState.selectedTags.every(tag => pair.tags.includes(tag)); // Changed from 'some' to 'every'
            const matchesRanges = gameState.selectedRanges.length === 0 ||
                (pair.range && pair.range.some(range => gameState.selectedRanges.includes(range)));

            return matchesLevel && matchesTags && matchesRanges;
        },

        selectRandomPairFromCurrentCollection: async function () {
            const taxonSets = await api.taxonomy.fetchTaxonPairs();
            const filteredSets = gameLogic.filterHandling.filterTaxonPairs(taxonSets, {
                level: gameState.selectedLevel,
                ranges: gameState.selectedRanges,
                tags: gameState.selectedTags
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
                    updateGameState({
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
                    game.setNextSelectedPair(newPair);
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
            updateGameState({
                selectedLevel: newFilters.level ?? gameState.selectedLevel,
                selectedRanges: newFilters.ranges ?? gameState.selectedRanges,
                selectedTags: newFilters.tags ?? gameState.selectedTags
            });

            const currentPair = gameState.currentTaxonImageCollection.pair;
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
            let currentObservationURLs = game.getObservationURLs();
            if (url === currentObservationURLs.imageOne) {
                return gameState.taxonImageOne;
            } else if (url === currentObservationURLs.imageTwo) {
                return gameState.taxonImageTwo;
            } else {
                logger.error("Unable to determine current taxon name");
                return null;
            }
        },
    },

    collectionManagement: {
        async loadRandomPairFromCurrentCollection() {
            logger.debug(`Loading pair. Selected level: ${gameState.selectedLevel}`);

            if (gameLogic.collectionManagement.isCurrentPairInCollection()) {
                logger.debug("Current pair is in collection. No new pair loaded.");
                return;
            }

            try {
                const newPair = await gameLogic.pairManagement.selectRandomPairFromCurrentCollection();
                if (newPair) {
                    logger.debug(`New pair selected: ${newPair.taxon1} / ${newPair.taxon2}, Level: ${newPair.level}`);
                    game.setNextSelectedPair(newPair);
                    await gameSetup.setupGame(true);
                } else {
                    throw new Error("No pairs available in the current collection");
                }
            } catch (error) {
                logger.error("Error loading random pair:", error);
                ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
            } finally {
                game.setState(GameState.PLAYING);
                preloader.roundPreloader.clearPreloadedImagesForNextRound();
                preloader.roundPreloader.preloadForNextRound();
                preloader.pairPreloader.preloadForNextPair();
            }
        },

        isCurrentPairInCollection() {
            if (!gameState.currentTaxonImageCollection || !gameState.currentTaxonImageCollection.pair) {
                return false;
            }

            const currentPair = gameState.currentTaxonImageCollection.pair;
            const selectedLevel = gameState.selectedLevel;

            const matchesLevel = selectedLevel === '' || currentPair.level === selectedLevel;

            if (!matchesLevel) {
                logger.debug(`Current pair not in collection - Skill level mismatch: Pair ${currentPair.level}, Selected ${selectedLevel}`);
            }

            return matchesLevel; // Simplified for now to focus on skill level
        },
    },

    // Public API

    // Pairs
    isCurrentPairInCollection() {
        return this.collectionManagement.isCurrentPairInCollection();
    },

    loadRandomPairFromCurrentCollection() {
        return this.collectionManagement.loadRandomPairFromCurrentCollection();
    },

    selectRandomPairFromCurrentCollection() {
        return this.pairManagement.selectRandomPairFromCurrentCollection();
    },

    loadNewRandomPair() {
        return this.pairManagement.loadNewRandomPair();
    },

    loadSetByID(setID, clearFilters = false) {
        return this.pairManagement.loadSetByID(setID, clearFilters);
    },
    
    // Game
    checkAnswer(droppedZoneId) {
        this.answerHandling.checkAnswer(droppedZoneId);
    },
    
    // No idea
    getCurrentTaxon(url) {
        return this.taxonHandling.getCurrentTaxon(url);
    },

    // Filters
    // this function is very popular for some reason… too popular ;)
    filterTaxonPairs(taxonPairs, filters) {
        return this.filterHandling.filterTaxonPairs(taxonPairs, filters);
    },

    applyFilters(newFilters) {
        this.filterHandling.applyFilters(newFilters);
    },
};

// Bind all methods to ensure correct 'this' context
Object.keys(gameLogic).forEach(key => {
    Object.keys(gameLogic[key]).forEach(methodKey => {
        if (typeof gameLogic[key][methodKey] === 'function') {
            gameLogic[key][methodKey] = gameLogic[key][methodKey].bind(gameLogic);
        }
    });
});

export default gameLogic;
