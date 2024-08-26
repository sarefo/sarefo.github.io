import api from './api.js';
import collectionManager from './collectionManager.js';
import config from './config.js';
import filtering from './filtering.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import preloader from './preloader.js';
import roundManager from './roundManager.js';
import setManager from './setManager.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';

const gameLogic = {
    answerHandling: {
        checkAnswer(droppedZoneId) {
            if (!this.isGameStateValid()) return;

            state.setState(state.GameState.CHECKING);
            const answers = this.getAnswersFromDropZones();

            if (this.areAnswersComplete(answers)) {
                this.evaluateAnswer(answers);
            } else {
                this.handleIncompleteAnswer();
            }
        },

        isGameStateValid() {
            const currentState = state.getState();
            if (currentState !== state.GameState.PLAYING) {
                logger.debug(`Cannot check answer when not in PLAYING state. Current state: ${currentState}`);
                return false;
            }
            return true;
        },

        getAnswersFromDropZones() {
            const dropOne = document.getElementById('drop-1');
            const dropTwo = document.getElementById('drop-2');
            return {
                leftAnswer: dropOne.children[0]?.getAttribute('data-taxon'),
                rightAnswer: dropTwo.children[0]?.getAttribute('data-taxon')
            };
        },

        areAnswersComplete(answers) {
            return answers.leftAnswer && answers.rightAnswer;
        },

        evaluateAnswer(answers) {
            const isCorrect =
                answers.leftAnswer === state.getTaxonImageOne() &&
                answers.rightAnswer === state.getTaxonImageTwo();

            if (isCorrect) {
                this.handleCorrectAnswer();
            } else {
                this.handleIncorrectAnswer();
            }
        },

        handleIncompleteAnswer() {
            logger.debug("Incomplete answer. Returning to PLAYING state.");
            state.setState(state.GameState.PLAYING);
        },

        async handleCorrectAnswer() {
            await ui.showOverlay('Correct!', config.overlayColors.green);
            ui.prepareImagesForLoading();
            await utils.ui.sleep(2000);
            await gameSetup.setupGame(false);
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
            this.prepareForNewPair();

            try {
                await this.attemptToLoadNewPair(usePreloadedPair);
            } catch (error) {
                this.handlePairLoadingError(error);
            } finally {
                this.finalizePairLoading();
            }
        },

        prepareForNewPair() {
            state.setState(state.GameState.LOADING);
            ui.prepareImagesForLoading();
            preloader.roundPreloader.clearPreloadedImagesForNextRound();
        },

        async attemptToLoadNewPair(usePreloadedPair) {
            await roundManager.loadNewRound(true);

            if (state.getState() !== state.GameState.PLAYING) {
                await this.fallbackPairLoading(usePreloadedPair);
            }

            const newPair = state.getCurrentTaxonImageCollection().pair;
            this.updateUIForNewPair(newPair);
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

        async loadPreloadedPair() {
            const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
            if (preloadedImages && preloadedImages.pair && this.isPairValidForCurrentFilters(preloadedImages.pair)) {
                await gameSetup.setupGameWithPreloadedPair(preloadedImages);
                return preloadedImages.pair;
            }
            return null;
        },

        async selectAndSetupRandomPair() {
            const newPair = await this.selectRandomPairFromCurrentCollection();
            if (newPair) {
                state.setNextSelectedPair(newPair);
                await gameSetup.setupGame(true);
                return newPair;
            }
            throw new Error("No pairs available in the current collection");
        },

        updateUIForNewPair(newPair) {
            ui.hideOverlay();
            if (newPair) {
                ui.updateLevelIndicator(newPair.level);
            }
        },

        handlePairLoadingError(error) {
            logger.error("Error loading new pair:", error);
            ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
        },

        finalizePairLoading() {
            if (state.getState() !== state.GameState.PLAYING) {
                state.setState(state.GameState.PLAYING);
            }
            preloader.startPreloading(true);
        },

        isPairValidForCurrentFilters(pair) {
            if (!pair) {
                logger.warn("Received undefined pair in isPairValidForCurrentFilters");
                return false;
            }

            const filters = filtering.getActiveFilters();
            return this.checkAllFilterCriteria(pair, filters);
        },

        getCurrentFilters() {
            return {
                selectedLevel: state.getSelectedLevel(),
                selectedTags: state.getSelectedTags(),
                selectedRanges: state.getSelectedRanges(),
                searchTerm: state.getSearchTerm(),
                phylogenyId: state.getPhylogenyId()
            };
        },

        checkAllFilterCriteria(pair, filters) {
            return this.matchesLevel(pair, filters.level) &&
                this.matchesTags(pair, filters.tags) &&
                this.matchesRanges(pair, filters.ranges) &&
                this.matchesPhylogeny(pair, filters.phylogenyId);
        },

        matchesLevel(pair, selectedLevel) {
            return selectedLevel === '' || pair.level === selectedLevel;
        },

        matchesTags(pair, selectedTags) {
            return selectedTags.length === 0 ||
                (pair.tags && selectedTags.every(tag => pair.tags.includes(tag)));
        },

        matchesRanges(pair, selectedRanges) {
            return selectedRanges.length === 0 ||
                (pair.range && pair.range.some(range => selectedRanges.includes(range)));
        },

        matchesSearch(pair, searchTerm) {
            if (!searchTerm) return true;
            const lowercaseSearch = searchTerm.toLowerCase();
            return (pair.taxonNames && pair.taxonNames.some(name => name.toLowerCase().includes(lowercaseSearch))) ||
                (pair.setName && pair.setName.toLowerCase().includes(lowercaseSearch)) ||
                (pair.tags && pair.tags.some(tag => tag.toLowerCase().includes(lowercaseSearch)));
        },

        matchesPhylogeny(pair, phylogenyId) {
            if (!phylogenyId) return true;
            return pair.taxa.some(taxonId => filtering.isDescendantOf(taxonId, phylogenyId));
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
                    this.clearAllFilters();
                }

                const newPair = await setManager.getSetByID(setID);
                if (newPair) {
                    await this.setupNewPair(newPair, setID);
                } else {
                    logger.warn(`Set with ID ${setID} not found.`);
                }
            } catch (error) {
                logger.error(`Error loading set with ID ${setID}:`, error);
            }
        },

        clearAllFilters() {
            state.updateGameStateMultiple({
                selectedTags: [],
                selectedRanges: [],
                selectedLevel: ''
            });
            collectionManager.updateUIForClearedFilters();
        },

        async setupNewPair(newPair, setID) {
            state.setNextSelectedPair(newPair);
            await gameSetup.setupGame(true);
            const nextSetID = String(Number(setID) + 1);
            preloader.pairPreloader.preloadSetByID(nextSetID);
        },
    },

    taxonHandling: {
        getCurrentTaxon(url) {
            const currentObservationURLs = state.getObservationURLs();
            if (url === currentObservationURLs.imageOne) {
                return state.getTaxonImageOne();
            } else if (url === currentObservationURLs.imageTwo) {
                return state.getTaxonImageTwo();
            } else {
                logger.error(`Unable to determine current taxon name. URL: ${url} does not match any current observation URL.`);
                return null;
            }
        },
    },

    collectionManagement: {
        async loadRandomPairFromCurrentCollection() {
            logger.debug(`Loading pair. Selected level: ${state.getSelectedLevel()}`);

            if (this.isCurrentPairInCollection()) {
                logger.debug("Current pair is in collection. Keeping current pair.");
                if (!preloader.pairPreloader.hasPreloadedPair() || 
                    !gameLogic.pairManagement.isPairValidForCurrentFilters(preloader.pairPreloader.getPreloadedImagesForNextPair().pair)) {
                    await preloader.pairPreloader.preloadForNextPair();
                }
            } else {
                logger.debug("Current pair is not in collection. Loading new random pair.");
                await gameLogic.pairManagement.loadNewRandomPair(true);
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
            logger.debug("starting isCurrentPairInCollection()");
            const currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
            if (!currentTaxonImageCollection || !currentTaxonImageCollection.pair) {
                return false;
            }

            const currentPair = currentTaxonImageCollection.pair;
            return gameLogic.pairManagement.isPairValidForCurrentFilters(currentPair);
        },
    },
};

// Bind all methods in gameLogic and its nested objects
Object.keys(gameLogic).forEach(key => {
    if (typeof gameLogic[key] === 'object') {
        Object.keys(gameLogic[key]).forEach(nestedKey => {
            if (typeof gameLogic[key][nestedKey] === 'function') {
                gameLogic[key][nestedKey] = gameLogic[key][nestedKey].bind(gameLogic[key]);
            }
        });
    }
});

const publicAPI = {
    // temporarily public for code restructuring purposes:
    isPairValidForCurrentFilters: gameLogic.pairManagement.isPairValidForCurrentFilters,

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

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(gameLogic);
    }
});

export default publicAPI;
