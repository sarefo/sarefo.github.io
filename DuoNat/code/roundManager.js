import api from './api.js';
import config from './config.js';
import filtering from './filtering.js';
import gameLogic from './gameLogic.js';
import hintSystem from './hintSystem.js';
import logger from './logger.js';
import preloader from './preloader.js';
import pairManager from './pairManager.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';
import worldMap from './worldMap.js';

const roundManager = {
    async loadNewRound(isNewPair = false) {
        logger.warn(`Starting loadNewRound. isNewPair: ${isNewPair}`);
        this.initializeRoundLoading();

        try {
            const pairData = await this.getPairData(isNewPair);
            const images = await this.getAndProcessImages(pairData, isNewPair);
            await this.setupRoundComponents(pairData.pair, images);
            this.updateGameState(pairData.pair, images);
            this.finalizeRoundLoading(isNewPair);
        } catch (error) {
            this.handleError(error);
        } finally {
            this.setGameStateToPlaying();
        }
    },

    initializeRoundLoading() {
        state.setState(state.GameState.LOADING);
        ui.prepareImagesForLoading();
    },

    async getPairData(isNewPair) {
        const pairData = await pairManager.getNextPair(isNewPair);
        
        if (!pairData || !pairData.pair) {
            logger.error('Invalid pairData structure received from pairManager.getNextPair');
            throw new Error('Invalid pairData: missing pair property');
        }
        
        return pairData;
    },

    async getAndProcessImages(pairData, isNewPair) {
        if (!pairData) {
            logger.error('Invalid pairData received in getAndProcessImages');
            throw new Error('Invalid pairData: pairData is undefined');
        }

        const images = await this.getImages(pairData, isNewPair);
        return this.randomizeImages(images, pairData.pair);
    },

    randomizeImages(images, pair) {
        const randomized = Math.random() < 0.5;
        //logger.debug(`Image randomization: ${randomized ? "swapped" : "not swapped"}`);

        return {
            leftImageSrc: randomized ? images.taxon2 : images.taxon1,
            rightImageSrc: randomized ? images.taxon1 : images.taxon2,
            taxonImageOne: randomized ? pair.taxon2 : pair.taxon1,
            taxonImageTwo: randomized ? pair.taxon1 : pair.taxon2,
            randomized
        };
    },

    async setupRoundComponents(pair, images) {
        this.setObservationURLs(images);
        await this.setupRound(pair, images);
        logger.debug(`Round setup complete`);
    },

    setObservationURLs(images) {
        state.setObservationURL(images.leftImageSrc, 1);
        state.setObservationURL(images.rightImageSrc, 2);
    },

    updateGameState(pair, images) {
        this.updateState(pair, images);
        logger.debug(`State updated`);
    },

    finalizeRoundLoading(isNewPair) {
        logger.debug(`Preloading started`);
        ui.hideOverlay();
        ui.resetUIState();
        logger.debug(`UI reset complete`);
        preloader.startPreloading(isNewPair);
    },

    setGameStateToPlaying() {
        state.setState(state.GameState.PLAYING);
        logger.debug(`loadNewRound complete. Game state set to PLAYING`);
    },

    /*async getNewPair() {
        let nextSelectedPair = state.getNextSelectedPair();
        if (nextSelectedPair) {
            state.setNextSelectedPair(null);
            return nextSelectedPair;
        }

        const preloadedPair = preloader.pairPreloader.getPreloadedImagesForNextPair();
        if (preloadedPair && this.isPairValid(preloadedPair.pair)) {
            const filters = {
                level: state.getSelectedLevel(),
                ranges: state.getSelectedRanges(),
                tags: state.getSelectedTags(),
                phylogenyId: state.getPhylogenyId(),
                searchTerm: state.getSearchTerm()
            };
            if (this.isPairValidForFilters(preloadedPair.pair, filters)) {
                return preloadedPair.pair;
            }
        }
        return await this.selectRandomPair();
    },*/

    /*isPairValid(pair) {
        return gameLogic.isPairValidForCurrentFilters(pair);
    },*/

    /*async selectRandomPair() {
        const filters = filtering.getActiveFilters();
        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        const filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);
        if (filteredPairs.length === 0) {
            throw new Error("No pairs available in the current collection");
        }
        return filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
    },*/

    /*isPairValidForFilters(pair, filters) {
        return filtering.pairMatchesFilters(pair, filters);
    },*/

    async getImages(pairData, isNewPair) {
        if (!pairData || !pairData.pair) {
            logger.error('Invalid pairData received in getImages');
            throw new Error('Invalid pairData: pair is undefined');
        }
        const { pair, preloadedImages } = pairData;
        if (isNewPair && preloadedImages) {
            logger.debug(`Using preloaded images for pair: ${pair.taxon1} / ${pair.taxon2}`);
            return { taxon1: preloadedImages.taxon1, taxon2: preloadedImages.taxon2 };
        }

        const preloadedRoundImages = preloader.roundPreloader.getPreloadedImagesForNextRound();
        if (preloadedRoundImages && preloadedRoundImages.taxon1 && preloadedRoundImages.taxon2) {
            logger.debug(`Using preloaded round images for pair: ${pair.taxon1} / ${pair.taxon2}`);
            preloader.roundPreloader.clearPreloadedImagesForNextRound();
            return { taxon1: preloadedRoundImages.taxon1, taxon2: preloadedRoundImages.taxon2 };
        }

        logger.debug(`Fetching new images for pair: ${pair.taxon1} / ${pair.taxon2}`);
        return {
            taxon1: await preloader.imageLoader.fetchDifferentImage(pair.taxon1, null),
            taxon2: await preloader.imageLoader.fetchDifferentImage(pair.taxon2, null)
        };
    },

    async setupRound(pair, images) {
        const { leftImageSrc, rightImageSrc, randomized } = images;
        await Promise.all([
            this.loadImage(state.getElement('imageOne'), leftImageSrc),
            this.loadImage(state.getElement('imageTwo'), rightImageSrc)
        ]);
        await this.setupNameTiles(pair, randomized);
        await this.setupWorldMaps(pair, randomized);
        await hintSystem.updateAllHintButtons();
    },

    async loadImage(imgElement, src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                imgElement.src = src;
                imgElement.classList.remove('image-container__image--loading');
                setTimeout(() => {
                    imgElement.classList.add('image-container__image--loaded');
                    resolve();
                }, 50);
            };
            img.src = src;
        });
    },

    async setupNameTiles(pair, randomized) {
        const [leftVernacular, rightVernacular] = await Promise.all([
            utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(randomized ? pair.taxon2 : pair.taxon1)),
            utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(randomized ? pair.taxon1 : pair.taxon2))
        ]);

        ui.setupNameTilesUI(
            randomized ? pair.taxon2 : pair.taxon1,
            randomized ? pair.taxon1 : pair.taxon2,
            leftVernacular,
            rightVernacular
        );

        state.getElement('imageOne').alt = `${randomized ? pair.taxon2 : pair.taxon1} Image`;
        state.getElement('imageTwo').alt = `${randomized ? pair.taxon1 : pair.taxon2} Image`;

        return { leftVernacular, rightVernacular };
    },

    async setupWorldMaps(pair, randomized) {
        const [leftContinents, rightContinents] = await Promise.all([
            this.getContinentForTaxon(randomized ? pair.taxon1 : pair.taxon2),
            this.getContinentForTaxon(randomized ? pair.taxon2 : pair.taxon1)
        ]);

        worldMap.createWorldMap(state.getElement('imageOneContainer'), leftContinents);
        worldMap.createWorldMap(state.getElement('imageTwoContainer'), rightContinents);
    },

    async getContinentForTaxon(taxon) {
        const taxonInfo = await api.taxonomy.loadTaxonInfo();
        const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxon.toLowerCase());

        if (taxonData && taxonData.range && taxonData.range.length > 0) {
            return taxonData.range.map(code => worldMap.getFullContinentName(code));
        }
        logger.debug(`No range data found for ${taxon}. Using placeholder.`);
        return [];
    },

    updateState(pair, images) {
        state.updateRoundState(pair, images);
        ui.updateLevelIndicator(pair.level || '1');
    },

    handleError(error) {
        logger.error("Error loading round:", error);
        ui.showOverlay("Error loading round. Please try again.", config.overlayColors.red);
    }
};

// Bind all methods to ensure correct 'this' context
Object.keys(roundManager).forEach(key => {
    if (typeof roundManager[key] === 'function') {
        roundManager[key] = roundManager[key].bind(roundManager);
    }
});

const publicAPI = {
    loadNewRound: roundManager.loadNewRound,
    setupRound: roundManager.setupRound,
    setupNameTiles: roundManager.setupNameTiles,
    setupWorldMaps: roundManager.setupWorldMaps,
    getContinentForTaxon: roundManager.getContinentForTaxon,
};

export default publicAPI;
