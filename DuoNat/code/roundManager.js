import api from './api.js';
import config from './config.js';
import filtering from './filtering.js';
import gameLogic from './gameLogic.js';
import hintSystem from './hintSystem.js';
import logger from './logger.js';
import preloader from './preloader.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';
import worldMap from './worldMap.js';

const roundManager = {
    async loadNewRound(isNewPair = false) {
        logger.debug(`Starting loadNewRound. isNewPair: ${isNewPair}`);
        state.setState(state.GameState.LOADING);
        ui.prepareImagesForLoading();

        try {
            const pairData = await this.getPair(isNewPair);
            logger.debug(`Got pair: ${JSON.stringify(pairData.pair)}`);
            const images = await this.getImages(pairData, isNewPair);
            logger.debug(`Got images: ${JSON.stringify(images)}`);
            await this.setupRound(pairData.pair, images);
            logger.debug(`Round setup complete`);
            this.updateState(pairData.pair, images);
            logger.debug(`State updated`);
            logger.debug(`Preloading started`);
            ui.hideOverlay();
            ui.resetUIState();
            logger.debug(`UI reset complete`);
            preloader.startPreloading(isNewPair);
        } catch (error) {
            this.handleError(error);
        } finally {
            state.setState(state.GameState.PLAYING);
            logger.debug(`loadNewRound complete. Game state set to PLAYING`);
        }
    },

    async getPair(isNewPair) {
        if (isNewPair) {
            const preloadedPair = preloader.pairPreloader.getPreloadedImagesForNextPair();
            if (preloadedPair && preloadedPair.pair) {
                logger.debug(`Using preloaded pair: ${preloadedPair.pair.taxon1} / ${preloadedPair.pair.taxon2}`);
                return { pair: preloadedPair.pair, preloadedImages: preloadedPair };
            }
            return { pair: await this.getNewPair(), preloadedImages: null };
        }
        return { pair: state.getCurrentTaxonImageCollection().pair, preloadedImages: null };
    },

    async getNewPair() {
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
    },

    isPairValid(pair) {
        return gameLogic.isPairValidForCurrentFilters(pair);
    },

    async selectRandomPair() {
        const filters = filtering.getActiveFilters();
        const taxonSets = await api.taxonomy.fetchTaxonPairs();
        const filteredSets = filtering.filterTaxonPairs(taxonSets, filters);
        if (filteredSets.length === 0) {
            throw new Error("No pairs available in the current collection");
        }
        return filteredSets[Math.floor(Math.random() * filteredSets.length)];
    },

    isPairValidForFilters(pair, filters) {
        return filtering.pairMatchesFilters(pair, filters);
    },

    async getImages(pairData, isNewPair) {
        const { pair, preloadedImages } = pairData;
        if (isNewPair && preloadedImages) {
            logger.debug(`Using preloaded images for pair: ${pair.taxon1} / ${pair.taxon2}`);
            return { taxon1: preloadedImages.taxon1, taxon2: preloadedImages.taxon2 };
        }

        logger.debug(`Fetching new images for pair: ${pair.taxon1} / ${pair.taxon2}`);
        return {
            taxon1: await preloader.imageLoader.fetchDifferentImage(pair.taxon1, null),
            taxon2: await preloader.imageLoader.fetchDifferentImage(pair.taxon2, null)
        };
    },

    async setupRound(pair, images) {
        const randomized = Math.random() < 0.5;
        await Promise.all([
            roundManager.loadImage(state.getElement('imageOne'), randomized ? images.taxon1 : images.taxon2),
            roundManager.loadImage(state.getElement('imageTwo'), randomized ? images.taxon2 : images.taxon1)
        ]);
        await roundManager.setupNameTiles(pair, randomized);
        await roundManager.setupWorldMaps(pair, randomized);
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
            utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(randomized ? pair.taxon1 : pair.taxon2)),
            utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(randomized ? pair.taxon2 : pair.taxon1))
        ]);

        ui.setupNameTilesUI(
            randomized ? pair.taxon1 : pair.taxon2,
            randomized ? pair.taxon2 : pair.taxon1,
            leftVernacular,
            rightVernacular
        );

        return { leftVernacular, rightVernacular };
    },

    async setupWorldMaps(pair, randomized) {
        const [leftContinents, rightContinents] = await Promise.all([
            roundManager.getContinentForTaxon(randomized ? pair.taxon1 : pair.taxon2),
            roundManager.getContinentForTaxon(randomized ? pair.taxon2 : pair.taxon1)
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
        const { taxon1, taxon2, randomized, leftVernacular, rightVernacular } = images;
        state.updateGameStateMultiple({
            currentTaxonImageCollection: {
                pair,
                imageOneURL: taxon1,
                imageTwoURL: taxon2,
                level: pair.level || '1',
            },
            usedImages: {
                taxon1: new Set([taxon1]),
                taxon2: new Set([taxon2]),
            },
            taxonImageOne: pair.taxon1,
            taxonImageTwo: pair.taxon2,
            currentRound: {
                pair,
                imageOneURL: taxon1,
                imageTwoURL: taxon2,
                imageOneVernacular: leftVernacular,
                imageTwoVernacular: rightVernacular,
                randomized,
            },
        });
        state.setCurrentSetID(pair.setID || state.getCurrentSetID());
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
};

export default publicAPI;
