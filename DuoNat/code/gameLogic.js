import api from './api.js';
import config from './config.js';
import { gameState, updateGameState, GameState } from './state.js';
import logger from './logger.js';
import ui from './ui.js';
import utils from './utils.js';
import game from './game.js';
import gameSetup from './gameSetup.js';
import gameUI from './gameUI.js';
import preloader from './preloader.js';

const gameLogic = {

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
                this.handleCorrectAnswer();
            } else {
                this.handleIncorrectAnswer();
            }
        } else {
            logger.debug("Incomplete answer. Returning to PLAYING state.");
            game.setState(GameState.PLAYING);
        }
    },

    async handleCorrectAnswer() {
        await ui.showOverlay('Correct!', config.overlayColors.green);
        gameUI.prepareImagesForLoading();
        await utils.sleep(2000); // Show "Correct!" for a while
        ui.updateOverlayMessage(`${game.loadingMessage}`); // Update message without changing color
        await gameSetup.setupGame(false);  // Start a new round with the same taxon pair
    },

    async handleIncorrectAnswer() {
        utils.resetDraggables();
        await ui.showOverlay('Try again!', config.overlayColors.red);
        await utils.sleep(1200);
        ui.hideOverlay();
        game.setState(GameState.PLAYING);
    },

    async loadNewRandomPair() {
        if (game.currentState === GameState.LOADING) {
            logger.debug("Already loading a new pair, ignoring request");
            return;
        }

        logger.debug(`Loading new random pair. Selected level: ${gameState.selectedLevel}`);
        game.setState(GameState.LOADING);
        ui.showOverlay(`${game.loadingMessage}`, config.overlayColors.green);
        gameUI.prepareImagesForLoading();

        try {
            let newPair;
            const preloadedImages = preloader.getPreloadedImagesForNextPair();
            
            if (preloadedImages && preloadedImages.pair && this.isPairInCurrentCollection(preloadedImages.pair)) {
                logger.debug(`Using preloaded pair: ${preloadedImages.pair.taxon1} / ${preloadedImages.pair.taxon2}, Skill Level: ${preloadedImages.pair.skillLevel}`);
                newPair = preloadedImages.pair;
                game.nextSelectedPair = newPair;
                await gameSetup.setupGameWithPreloadedPair(preloadedImages);
            } else {
                logger.debug("No valid preloaded pair available, selecting random pair");
                newPair = await this.selectRandomPairFromCurrentCollection();
                if (newPair) {
                    logger.debug(`Selected new pair: ${newPair.taxon1} / ${newPair.taxon2}, Skill Level: ${newPair.skillLevel}`);
                    game.nextSelectedPair = newPair;
                    await gameSetup.setupGame(true);
                } else {
                    throw new Error("No pairs available in the current collection");
                }
            }

            ui.hideOverlay();
            gameUI.setNamePairHeight(); 
            gameUI.updateSkillLevelIndicator(gameState.currentTaxonImageCollection.pair.skillLevel);
        } catch (error) {
            logger.error("Error loading new pair:", error);
            ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
        } finally {
            game.setState(GameState.PLAYING);
            // Start preloading for next round and pair
            gameSetup.startPreloading(true);
        }
    },

    // Update this method to set the nextSelectedPair
    async loadNewTaxonPair(newPair) {
        this.nextSelectedPair = newPair;
        await gameSetup.setupGame(true);
    },

    async applyFilters(newFilters) {
        updateGameState({
            selectedLevel: newFilters.level || gameState.selectedLevel,
            selectedRanges: newFilters.ranges || gameState.selectedRanges,
            selectedTags: newFilters.tags || gameState.selectedTags
        });
        
        logger.debug(`Applied new filters: Level ${gameState.selectedLevel}, Ranges ${gameState.selectedRanges}, Tags ${gameState.selectedTags}`);

        // Check if current pair is still valid
        if (!this.isCurrentPairInCollection()) {
            logger.debug("Current pair no longer valid with new filters, loading new pair");
            await this.loadRandomPairFromCurrentCollection();
        } else {
            logger.debug("Current pair still valid with new filters");
        }
        
        // Trigger preloading
        preloader.preloadForNextPair();
    },

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

    // TODO should probably be somewhere with other select-set-dialog functionality
    loadRandomPairFromCurrentCollection: async function() {
        logger.debug(`Loading pair. Selected level: ${gameState.selectedLevel}`);

        if (this.isCurrentPairInCollection()) {
            logger.debug("Current pair is in collection. No new pair loaded.");
            return;
        }

        try {
            const newPair = await this.selectRandomPairFromCurrentCollection();
            if (newPair) {
                logger.debug(`New pair selected: ${newPair.taxon1} / ${newPair.taxon2}, Skill Level: ${newPair.skillLevel}`);
                game.nextSelectedPair = newPair;
                await gameSetup.setupGame(true);
            } else {
                throw new Error("No pairs available in the current collection");
            }
        } catch (error) {
            logger.error("Error loading random pair:", error);
            ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
        } finally {
            game.setState(GameState.PLAYING);
            preloader.clearPreloadedImagesForNextRound();
            preloader.preloadForNextRound();
            preloader.preloadForNextPair();
        }
    },

    isPairInCurrentCollection: function(pair) {
        const selectedTags = gameState.selectedTags;
        const selectedLevel = gameState.selectedLevel;
        const selectedRanges = gameState.selectedRanges;

        const matchesTags = selectedTags.length === 0 || 
            pair.tags.some(tag => selectedTags.includes(tag));
        const matchesLevel = selectedLevel === '' || 
            pair.skillLevel === selectedLevel;
        const matchesRanges = selectedRanges.length === 0 || 
            (pair.range && pair.range.some(range => selectedRanges.includes(range)));

        return matchesTags && matchesLevel && matchesRanges;
    },

    isCurrentPairInCollection: function() {
        if (!gameState.currentTaxonImageCollection || !gameState.currentTaxonImageCollection.pair) {
            return false;
        }

        const currentPair = gameState.currentTaxonImageCollection.pair;
        const selectedLevel = gameState.selectedLevel;

        const matchesLevel = selectedLevel === '' || currentPair.skillLevel === selectedLevel;

        if (!matchesLevel) {
            logger.debug(`Current pair not in collection - Skill level mismatch: Pair ${currentPair.skillLevel}, Selected ${selectedLevel}`);
        }

        return matchesLevel; // Simplified for now to focus on skill level
    },

    selectRandomPairFromCurrentCollection: async function() {
        const taxonPairs = await api.fetchTaxonPairs();
        logger.debug(`Total taxon pairs: ${taxonPairs.length}`);
        
        const filteredPairs = taxonPairs.filter(pair => this.isPairInCurrentCollection(pair));
        logger.debug(`Filtered pairs: ${filteredPairs.length}`);
        
        if (filteredPairs.length === 0) {
            logger.warn("No pairs match the current collection criteria");
            return null;
        }

        // Ensure we're not selecting the current pair
        const currentPair = gameState.currentTaxonImageCollection?.pair;
        const availablePairs = currentPair 
            ? filteredPairs.filter(pair => 
                pair.taxon1 !== currentPair.taxon1 || pair.taxon2 !== currentPair.taxon2)
            : filteredPairs;

        if (availablePairs.length === 0) {
            logger.warn("All filtered pairs have been used, resetting selection");
            availablePairs = filteredPairs;
        }

        const randomIndex = Math.floor(Math.random() * availablePairs.length);
        const selectedPair = availablePairs[randomIndex];
        
        logger.debug(`Selected random pair: ${selectedPair.taxon1} / ${selectedPair.taxon2}, Skill Level: ${selectedPair.skillLevel}`);
        
        return selectedPair;
    },
};

Object.keys(gameLogic).forEach(key => {
    if (typeof gameLogic[key] === 'function') {
        gameLogic[key] = gameLogic[key].bind(gameLogic);
    }
});

export default gameLogic;
