import api from './api.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import setManager from './setManager.js';
import state from './state.js';

const imageLoader = {
    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => {
                logger.error(`Failed to load image: ${url}`);
                reject(url);
            };
            img.src = url;
        });
    },

    async fetchDifferentImage(taxonName, currentImageURL) {
        const images = await api.images.fetchMultipleImages(taxonName, 12);
        const usedImages = this.getUsedImagesForTaxon(taxonName);
        let availableImages = this.filterAvailableImages(images, usedImages, currentImageURL);

        if (availableImages.length === 0) {
            availableImages = this.resetUsedImages(images, currentImageURL);
        }

        return this.selectAndUpdateUsedImage(availableImages, usedImages, taxonName);
    },

    getUsedImagesForTaxon(taxonName) {
        const currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
        if (currentTaxonImageCollection) {
            const taxonKey = taxonName === currentTaxonImageCollection.pair.taxon1 ? 'taxon1' : 'taxon2';
            return state.getUsedImages()[taxonKey] || new Set();
        }
        return new Set();
    },

    filterAvailableImages(images, usedImages, currentImageURL) {
        return images.filter(img => !usedImages.has(img) && img !== currentImageURL);
    },

    resetUsedImages(images, currentImageURL) {
        logger.warn(`All images have been used. Resetting used images.`);
        return images.filter(img => img !== currentImageURL);
    },

    selectAndUpdateUsedImage(availableImages, usedImages, taxonName) {
        if (availableImages.length > 0) {
            const selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
            this.updateUsedImagesState(usedImages, selectedImage, taxonName);
            return selectedImage;
        } else {
            logger.error(`No available images found for ${taxonName}. Using current image.`);
            return currentImageURL || availableImages[0];
        }
    },

    updateUsedImagesState(usedImages, selectedImage, taxonName) {
        usedImages.add(selectedImage);
        const currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
        if (currentTaxonImageCollection) {
            const taxonKey = taxonName === currentTaxonImageCollection.pair.taxon1 ? 'taxon1' : 'taxon2';
            state.updateGameStateMultiple({
                usedImages: {
                    ...state.getUsedImages(),
                    [taxonKey]: usedImages
                }
            });
        }
    },
};

const roundPreloader = {
    async preloadForNextRound() {
        const { pair, imageOneURL, imageTwoURL } = state.getCurrentTaxonImageCollection();
        const [newImageOneURL, newImageTwoURL] = await Promise.all([
            imageLoader.fetchDifferentImage(pair.taxon1, imageOneURL),
            imageLoader.fetchDifferentImage(pair.taxon2, imageTwoURL)
        ]);

        await Promise.all([
            imageLoader.preloadImage(newImageOneURL),
            imageLoader.preloadImage(newImageTwoURL)
        ]);

        preloader.preloadedImages.nextRound = { taxon1: newImageOneURL, taxon2: newImageTwoURL };
        logger.debug("Preloaded images for next round:", preloader.preloadedImages.nextRound);
    },

    getPreloadedImagesForNextRound() {
        const images = preloader.preloadedImages.nextRound;
        preloader.preloadedImages.nextRound = { taxon1: null, taxon2: null };
        return images;
    },

    clearPreloadedImagesForNextRound() {
        preloader.preloadedImages.nextRound = { taxon1: null, taxon2: null };
        logger.debug("Cleared preloaded images for next round");
    },
};

const pairPreloader = {
    async preloadForNextPair() {
        if (preloader.isPreloading) return;

        preloader.isPreloading = true;
        try {
            const newPair = await gameLogic.selectRandomPairFromCurrentCollection();
            if (newPair) {
                await this.preloadPairImages(newPair);
            }
        } catch (error) {
            logger.error("Error preloading next pair:", error);
            preloader.preloadedImages.nextPair = null;
        } finally {
            preloader.isPreloading = false;
        }
    },

    async preloadPairImages(pair) {
        const [imageOneURL, imageTwoURL] = await Promise.all([
            imageLoader.fetchDifferentImage(pair.taxon1, null),
            imageLoader.fetchDifferentImage(pair.taxon2, null)
        ]);

        await Promise.all([
            imageLoader.preloadImage(imageOneURL),
            imageLoader.preloadImage(imageTwoURL)
        ]);

        preloader.preloadedImages.nextPair = {
            pair: pair,
            taxon1: imageOneURL,
            taxon2: imageTwoURL
        };
    },

    isPairValid(pair) {
        const selectedLevel = state.getSelectedLevel();
        const matchesLevel = selectedLevel === '' || pair.level === selectedLevel;

        if (!matchesLevel) {
            logger.debug(`Pair invalid - Skill level mismatch: Pair ${pair.level}, Selected ${selectedLevel}`);
        }

        return matchesLevel;
    },

    getPreloadedImagesForNextPair() {
        if (this.hasPreloadedPair()) {
            const images = preloader.preloadedImages.nextPair;
            logger.debug(`Retrieving preloaded pair: ${images.pair.taxon1} / ${images.pair.taxon2}, Skill Level: ${images.pair.level}`);
            preloader.preloadedImages.nextPair = null;
            return images;
        } else {
            logger.debug("No preloaded pair available");
            return null;
        }
    },

    hasPreloadedPair() {
        return preloader.preloadedImages.nextPair != null && preloader.preloadedImages.nextPair.pair != null;
    },

    async preloadNewPairWithTags(selectedTags, selectedLevel, selectedRanges) {
        if (preloader.isPreloading) {
            logger.debug("Preloading already in progress, skipping tag-based preload");
            return;
        }

        preloader.isPreloading = true;
        //        logger.debug(`Preloading with selected tags: ${selectedTags}, level: ${selectedLevel}, and ranges: ${selectedRanges}`);
        try {
            const allPairs = await api.taxonomy.fetchTaxonPairs();
            const filteredPairs = this.filterPairsByTags(allPairs, selectedTags, selectedLevel, selectedRanges);
            const newPair = this.selectNewPair(filteredPairs, allPairs);
            await this.preloadPairImages(newPair);
            //            logger.debug("Preloaded new pair based on selected tags, level, and ranges");
        } catch (error) {
            logger.error("Error preloading new pair with tags, level, and ranges:", error);
        } finally {
            preloader.isPreloading = false;
        }
    },

    filterPairsByTags(allPairs, selectedTags, selectedLevel, selectedRanges) {
        const tags = Array.isArray(selectedTags) ? selectedTags : [];
        const ranges = Array.isArray(selectedRanges) ? selectedRanges : [];
        const level = typeof selectedLevel === 'string' ? selectedLevel : '';

        return allPairs.filter(pair => {
            const matchesLevel = level === '' || pair.level === level;
            const matchesRanges = ranges.length === 0 ||
                (pair.range && pair.range.some(range => ranges.includes(range)));
            const matchesTags = tags.length === 0 ||
                (pair.tags && pair.tags.some(tag => tags.includes(tag)));
            const isDifferentFromCurrent = this.isDifferentFromCurrentPair(pair);

            return matchesLevel && matchesRanges && matchesTags && isDifferentFromCurrent;
        });
    },

    isDifferentFromCurrentPair(pair) {
        const currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
        return !currentTaxonImageCollection ||
            !currentTaxonImageCollection.pair ||
            pair.taxon1 !== currentTaxonImageCollection.pair.taxon1 ||
            pair.taxon2 !== currentTaxonImageCollection.pair.taxon2;
    },

    selectNewPair(filteredPairs, allPairs) {
        if (filteredPairs.length > 0) {
            const newPair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
            //            logger.debug("Selected new pair matching criteria");
            return newPair;
        } else {
            const newPair = allPairs[Math.floor(Math.random() * allPairs.length)];
            logger.warn("No pairs match the criteria. Selected a random pair from all pairs.");
            return newPair;
        }
    },

    async preloadSetByID(setID) {
        try {
            const nextPair = await setManager.getSetByID(setID);
            if (nextPair) {
                await this.preloadPairImages(nextPair);
                logger.debug(`Preloaded set with ID ${setID}`);
            } else {
                logger.warn(`Set with ID ${setID} not found for preloading`);
            }
        } catch (error) {
            logger.error(`Error preloading set with ID ${setID}:`, error);
        }
    },
};

const preloader = {
    preloadedImages: {
        nextRound: { taxon1: null, taxon2: null },
        nextPair: { taxon1: null, taxon2: null, pair: null }
    },
    isPreloading: false,

    imageLoader,
    roundPreloader,
    pairPreloader,

    async startPreloading(isNewPair) {
        logger.debug(`Starting preloading. isNewPair: ${isNewPair}`);
        try {
            await this.roundPreloader.preloadForNextRound();
            if (isNewPair || !this.pairPreloader.hasPreloadedPair()) {
                await this.pairPreloader.preloadForNextPair();
            }
            logger.debug("Preloading completed for next round" + (isNewPair ? " and next pair" : ""));
        } catch (error) {
            logger.error("Error during preloading:", error);
        }
    },
};

// Bind all methods to ensure correct 'this' context
Object.keys(preloader).forEach(key => {
    if (typeof preloader[key] === 'object') {
        Object.keys(preloader[key]).forEach(subKey => {
            if (typeof preloader[key][subKey] === 'function') {
                preloader[key][subKey] = preloader[key][subKey].bind(preloader[key]);
            }
        });
    }
});

const publicAPI = {
    startPreloading: preloader.startPreloading.bind(preloader),
    pairPreloader: {
        getPreloadedImagesForNextPair: preloader.pairPreloader.getPreloadedImagesForNextPair,
        isPairValid: preloader.pairPreloader.isPairValid,
        preloadNewPairWithTags: preloader.pairPreloader.preloadNewPairWithTags,
        preloadSetByID: preloader.pairPreloader.preloadSetByID,
        preloadForNextPair: preloader.pairPreloader.preloadForNextPair,
    },
    roundPreloader: {
        getPreloadedImagesForNextRound: preloader.roundPreloader.getPreloadedImagesForNextRound,
        clearPreloadedImagesForNextRound: preloader.roundPreloader.clearPreloadedImagesForNextRound,
        preloadForNextRound: preloader.roundPreloader.preloadForNextRound,
    },
    imageLoader: {
        fetchDifferentImage: preloader.imageLoader.fetchDifferentImage,
    }
};

export default publicAPI;
