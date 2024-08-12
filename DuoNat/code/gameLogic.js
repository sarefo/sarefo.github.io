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
            if (game.currentState !== GameState.PLAYING) {
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
            await ui.overlay.showOverlay('Correct!', config.overlayColors.green);
            gameUI.imageHandling.prepareImagesForLoading();
            await utils.sleep(2000); // Show "Correct!" for a while
            ui.overlay.updateOverlayMessage(`${game.loadingMessage}`); // Update message without changing color
            await gameSetup.setupGame(false);  // Start a new round with the same taxon pair
        },

        async handleIncorrectAnswer() {
            utils.resetDraggables();
            await ui.overlay.showOverlay('Try again!', config.overlayColors.red);
            await utils.sleep(1200);
            ui.overlay.hideOverlay();
            game.setState(GameState.PLAYING);
        },
    },
    
    pairManagement: {
    async loadNewRandomPair() {
        game.setState(GameState.LOADING);
        ui.overlay.showOverlay(`${game.loadingMessage}`, config.overlayColors.green);
        gameUI.imageHandling.prepareImagesForLoading();

        try {
            let newPair;
            const preloadedImages = preloader.getPreloadedImagesForNextPair();

            if (preloadedImages && preloadedImages.pair && gameLogic.pairManagement.isPairValidForCurrentFilters(preloadedImages.pair)) {
                newPair = preloadedImages.pair;
                await gameSetup.setupGameWithPreloadedPair(preloadedImages);
            } else {
                newPair = await this.selectRandomPairFromCurrentCollection();
                if (newPair) {
                    game.nextSelectedPair = newPair;
                    await gameSetup.setupGame(true);
                } else {
                    throw new Error("No pairs available in the current collection");
                }
            }

            ui.overlay.hideOverlay();
            ui.levelIndicator.updateLevelIndicator(newPair.level);
        } catch (error) {
            logger.error("Error loading new pair:", error);
            ui.overlay.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
        } finally {
            game.setState(GameState.PLAYING);
            preloader.clearPreloadedImagesForNextRound();
            preloader.preloadForNextRound();
            preloader.preloadForNextPair();
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
                    ui.taxonPairList.updateFilterSummary();
                    ui.filters.updateLevelDropdown();
                }

                const newPair = await setManager.getSetByID(setID);
                if (newPair) {
                    game.nextSelectedPair = newPair;
                    await gameSetup.setupGame(true);
                    const nextSetID = String(Number(setID) + 1);
                    preloader.preloadSetByID(nextSetID);
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
                preloader.preloadForNextPair();
            }
            ui.taxonPairList.updateFilterSummary();
        },
    },
    
    taxonHandling: {
        getCurrentTaxon(url) {
            if (url === game.currentObservationURLs.imageOne) {
                return gameState.taxonImageOne;
            } else if (url === game.currentObservationURLs.imageTwo) {
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
                    game.nextSelectedPair = newPair;
                    await gameSetup.setupGame(true);
                } else {
                    throw new Error("No pairs available in the current collection");
                }
            } catch (error) {
                logger.error("Error loading random pair:", error);
                ui.overlay.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
            } finally {
                game.setState(GameState.PLAYING);
                preloader.clearPreloadedImagesForNextRound();
                preloader.preloadForNextRound();
                preloader.preloadForNextPair();
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

    // Outward-facing API
    applyFilters(newFilters) {
        this.filterHandling.applyFilters(newFilters);
    },

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

    checkAnswer(droppedZoneId) {
        this.answerHandling.checkAnswer(droppedZoneId);
    },

    getCurrentTaxon(url) {
        return this.taxonHandling.getCurrentTaxon(url);
    },

    filterTaxonPairs(taxonPairs, filters) {
        return this.filterHandling.filterTaxonPairs(taxonPairs, filters);
    }
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
