import state from './state.js';
import api from './api.js';
import filtering from './filtering.js';
import preloader from './preloader.js';
import ui from './ui.js';
import logger from './logger.js';
import config from './config.js';
import utils from './utils.js';
import worldMap from './worldMap.js';
import hintSystem from './hintSystem.js';

const roundManager = {
    async loadNewRound(isNewPair = false) {
        logger.debug(`Starting loadNewRound. isNewPair: ${isNewPair}`);
        state.setState(state.GameState.LOADING);
        ui.prepareImagesForLoading();

        try {
            const pair = await roundManager.getPair(isNewPair);
            logger.debug(`Got pair: ${JSON.stringify(pair)}`);
            const images = await roundManager.getImages(pair, isNewPair);
            logger.debug(`Got images: ${JSON.stringify(images)}`);
            await roundManager.setupRound(pair, images);
            logger.debug(`Round setup complete`);
            roundManager.updateState(pair, images);
            logger.debug(`State updated`);
            roundManager.startPreloading(isNewPair);
            logger.debug(`Preloading started`);
            ui.hideOverlay();
            ui.resetUIState();
            logger.debug(`UI reset complete`);
        } catch (error) {
            roundManager.handleError(error);
        } finally {
            state.setState(state.GameState.PLAYING);
            logger.debug(`loadNewRound complete. Game state set to PLAYING`);
        }
    },

    async getPair(isNewPair) {
        if (isNewPair) {
            return await roundManager.getNewPair();
        }
        return state.getCurrentTaxonImageCollection().pair;
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
        return preloader.pairPreloader.isPairValid(pair);
    },

    async selectRandomPair() {
        const filters = {
            level: state.getSelectedLevel(),
            ranges: state.getSelectedRanges(),
            tags: state.getSelectedTags(),
            phylogenyId: state.getPhylogenyId(),
            searchTerm: state.getSearchTerm()
        };
        const taxonSets = await api.taxonomy.fetchTaxonPairs();
        const filteredSets = taxonSets.filter(pair => this.isPairValidForFilters(pair, filters));
        if (filteredSets.length === 0) {
            throw new Error("No pairs available in the current collection");
        }
        return filteredSets[Math.floor(Math.random() * filteredSets.length)];
    },

    isPairValidForFilters(pair, filters) {
        if (!pair) {
            logger.warn("Received undefined pair in isPairValidForFilters");
            return false;
        }

        const matchesLevel = filters.level === '' || pair.level === filters.level;
        const matchesTags = filters.tags.length === 0 ||
            (pair.tags && filters.tags.every(tag => pair.tags.includes(tag)));
        const matchesRanges = filters.ranges.length === 0 ||
            (pair.range && pair.range.some(range => filters.ranges.includes(range)));
        const matchesSearch = !filters.searchTerm ||
            (pair.taxonNames && pair.taxonNames.some(name => name.toLowerCase().includes(filters.searchTerm.toLowerCase()))) ||
            (pair.setName && pair.setName.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
            (pair.tags && pair.tags.some(tag => tag.toLowerCase().includes(filters.searchTerm.toLowerCase())));

        const matchesPhylogeny = !filters.phylogenyId ||
            pair.taxa.some(taxonId => filtering.isDescendantOf(taxonId, filters.phylogenyId));

        return matchesLevel && matchesTags && matchesRanges && matchesSearch && matchesPhylogeny;
    },

    async getImages(pair, isNewPair) {
        if (isNewPair) {
            const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
            if (preloadedImages && preloadedImages.pair.setID === pair.setID) {
                return { taxon1: preloadedImages.taxon1, taxon2: preloadedImages.taxon2 };
            }
        }

        const preloadedRoundImages = preloader.roundPreloader.getPreloadedImagesForNextRound();
        if (preloadedRoundImages && preloadedRoundImages.taxon1 && preloadedRoundImages.taxon2) {
            return preloadedRoundImages;
        }

        return {
            taxon1: await preloader.imageLoader.fetchDifferentImage(pair.taxon1, state.getCurrentRound().imageOneURL),
            taxon2: await preloader.imageLoader.fetchDifferentImage(pair.taxon2, state.getCurrentRound().imageTwoURL)
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
        state.updateGameStateMultiple({
            currentTaxonImageCollection: {
                pair: pair,
                imageOneURL: images.taxon1,
                imageTwoURL: images.taxon2,
                level: pair.level || '1',
            },
            usedImages: {
                taxon1: new Set([images.taxon1]),
                taxon2: new Set([images.taxon2]),
            },
            taxonImageOne: pair.taxon1,
            taxonImageTwo: pair.taxon2,
            currentRound: {
                pair: pair,
                imageOneURL: images.taxon1,
                imageTwoURL: images.taxon2,
                imageOneVernacular: images.leftVernacular,
                imageTwoVernacular: images.rightVernacular,
                randomized: images.randomized,
            },
        });
        state.setCurrentSetID(pair.setID || state.getCurrentSetID());
        ui.updateLevelIndicator(pair.level || '1');
    },

    startPreloading(isNewPair) {
        preloader.roundPreloader.preloadForNextRound();
        if (isNewPair) {
            preloader.pairPreloader.preloadForNextPair();
        }
    },

    handleError(error) {
        logger.error("Error loading round:", error);
        ui.showOverlay("Error loading round. Please try again.", config.overlayColors.red);
    }
};

const publicAPI = {
    loadNewRound: roundManager.loadNewRound,
};

export default publicAPI;
