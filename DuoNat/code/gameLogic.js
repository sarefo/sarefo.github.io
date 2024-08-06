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

//        logger.debug("Loading new pair");
        game.setState(GameState.LOADING);
        ui.showOverlay(`${game.loadingMessage}`, config.overlayColors.green);
        gameUI.prepareImagesForLoading();

        try {
            const preloadedPair = preloader.getPreloadedImagesForNextPair();
            if (preloadedPair && preloadedPair.pair) {
                logger.debug("Using preloaded pair:", preloadedPair.pair);
                await gameSetup.setupGameWithPreloadedPair(preloadedPair);
            } else {
                logger.debug("No preloaded pair available, selecting random pair");
                await gameSetup.setupGame(true);
            }
            ui.hideOverlay();
            gameUI.setNamePairHeight(); 
            gameUI.updateSkillLevelIndicator(gameState.currentTaxonImageCollection.pair.skillLevel);
        } catch (error) {
            logger.error("Error loading new pair:", error);
            ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
        } finally {
            game.setState(GameState.PLAYING);
            // Clear preloaded images for the next round
            preloader.clearPreloadedImagesForNextRound();
            // Start preloading for the next round and the next pair
            gameSetup.startPreloading(true);
        }
    },

    // Update this method to set the nextSelectedPair
    async loadNewTaxonPair(newPair) {
        this.nextSelectedPair = newPair;
        await gameSetup.setupGame(true);
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
        logger.debug("Attempting to load random pair from current collection");
        logger.debug(`Selected tags: ${gameState.selectedTags.join(', ')}`);
        logger.debug(`Selected level: ${gameState.selectedLevel}`);
        logger.debug(`Selected ranges: ${gameState.selectedRanges.join(', ')}`);

        if (this.isCurrentPairInCollection()) {
            logger.debug("Current pair is already in the collection. No new pair loaded.");
            return;
        }

        logger.debug("Loading random pair from current collection");
        game.setState(GameState.LOADING);
        ui.showOverlay(`${this.loadingMessage}`, config.overlayColors.green);

        try {
            const newPair = await this.selectRandomPairFromCurrentCollection();
            if (newPair) {
                logger.debug(`Selected new pair: ${newPair.taxon1} / ${newPair.taxon2}`);
                game.nextSelectedPair = newPair;
                await gameSetup.setupGame(true);
            } else {
                logger.error("No pairs available in the current collection");
                throw new Error("No pairs available in the current collection");
            }

            gameUI.updateSkillLevelIndicator(gameState.currentTaxonImageCollection.pair.skillLevel);

            ui.hideOverlay();
        } catch (error) {
            logger.error("Error loading random pair from collection:", error);
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


        const isInCollection = matchesTags && matchesLevel && matchesRanges;
//        logger.debug(`Is in collection: ${isInCollection}`);

        return isInCollection;
    },

    isCurrentPairInCollection: function() {
        if (!gameState.currentTaxonImageCollection || !gameState.currentTaxonImageCollection.pair) {
            logger.debug("No current pair in gameState");
            return false;
        }

        const currentPair = gameState.currentTaxonImageCollection.pair;
        const selectedTags = gameState.selectedTags;
        const selectedLevel = gameState.selectedLevel;
        const selectedRanges = gameState.selectedRanges;

        const matchesTags = selectedTags.length === 0 || 
            currentPair.tags.some(tag => selectedTags.includes(tag));
        const matchesLevel = selectedLevel === '' || 
            currentPair.skillLevel === selectedLevel;
        const matchesRanges = selectedRanges.length === 0 || 
            (currentPair.range && currentPair.range.some(range => selectedRanges.includes(range)));


        const isInCollection = matchesTags && matchesLevel && matchesRanges;

        return isInCollection;
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

        const selectedPair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
        logger.debug(`Selected pair: ${selectedPair.taxon1} / ${selectedPair.taxon2}`);

        return selectedPair;
    }

};

Object.keys(gameLogic).forEach(key => {
    if (typeof gameLogic[key] === 'function') {
        gameLogic[key] = gameLogic[key].bind(gameLogic);
    }
});

export default gameLogic;
