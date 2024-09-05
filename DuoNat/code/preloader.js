import api from './api.js';
import logger from './logger.js';
import pairManager from './pairManager.js';
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
        //logger.debug(`Fetching different image for ${taxonName}. Current image: ${currentImageURL}`);
        const images = await api.images.fetchMultipleImages(taxonName, 12);
        let usedImages = this.getUsedImagesForTaxon(taxonName);
        //logger.debug(`Fetched ${images.length} images for ${taxonName}. Currently used images: ${usedImages.size}`);
        
        let availableImages = this.filterAvailableImages(images, usedImages, currentImageURL);
        //logger.debug(`Available images after filtering: ${availableImages.length}`);

        if (availableImages.length === 0) {
            logger.warn(`All images have been used for ${taxonName}. Resetting used images.`);
            usedImages = new Set();
            this.updateUsedImagesState(usedImages, null, taxonName);
            availableImages = this.filterAvailableImages(images, usedImages, currentImageURL);
        }

        if (availableImages.length === 0) {
            logger.warn(`No available images for ${taxonName}. Using the current image.`);
            return currentImageURL || images[0];
        }

        const selectedImage = this.selectAndUpdateUsedImage(availableImages, usedImages, taxonName);
        //logger.debug(`Selected image for ${taxonName}: ${selectedImage}`);
        return selectedImage;
    },

    filterAvailableImages(images, usedImages, currentImageURL) {
        return images.filter(img => !usedImages.has(img) && img !== currentImageURL);
    },

    getUsedImagesForTaxon(taxonName) {
        const usedImages = state.getUsedImages();
        return usedImages[taxonName] || new Set();
    },

    getTaxonKey(taxonName) {
        const currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
        if (currentTaxonImageCollection) {
            return taxonName === currentTaxonImageCollection.pair.taxonA ? 'taxonA' : 'taxonB';
        }
        return taxonName; // Fallback to using the taxon name as the key
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
            //logger.debug(`Selected new image for ${taxonName}. Used images count: ${usedImages.size}`);
            return selectedImage;
        } else {
            logger.warn(`No available images found for ${taxonName}. Using the first image.`);
            return availableImages[0];
        }
    },

    updateUsedImagesState(usedImages, selectedImage, taxonName) {
        if (selectedImage) {
            usedImages.add(selectedImage);
        }
        const currentUsedImages = state.getUsedImages();
        state.updateGameStateMultiple({
            usedImages: {
                ...currentUsedImages,
                [taxonName]: usedImages
            }
        });
        //logger.debug(`Updated used images for ${taxonName}. New count: ${usedImages.size}`);
    },
};

const roundPreloader = {
    async preloadForNextRound() {
        try {
            const { pair, image1URL, image2URL } = state.getCurrentTaxonImageCollection();
            const [newImage1URL, newImage2URL] = await Promise.all([
                imageLoader.fetchDifferentImage(pair.taxonA, image1URL),
                imageLoader.fetchDifferentImage(pair.taxonB, image2URL)
            ]);

            await Promise.all([
                imageLoader.preloadImage(newImage1URL),
                imageLoader.preloadImage(newImage2URL)
            ]);

            preloader.preloadedImages.nextRound = { taxonA: newImage1URL, taxonB: newImage2URL };
            logger.debug("Preloading completed for next round");
        } catch (error) {
            logger.error("Error during round preloading:", error);
        }
        //logger.debug("Preloaded images for next round:", preloader.preloadedImages.nextRound);
    },

    getPreloadedImagesForNextRound() {
        const images = preloader.preloadedImages.nextRound;
        preloader.preloadedImages.nextRound = { taxonA: null, taxonB: null };
        return images;
    },

    getPreloadedImagesForRoundDemo() {
        const images = preloader.preloadedImages.nextRound;
        return images;
    },

    // called from:
    // - pairManager.loadNewRandomPair() > eliminate
    // - roundManager.getImages()
    clearPreloadedImagesForNextRound() {
        //logger.trace("clearPreloadedImagesForNextRound");
        preloader.preloadedImages.nextRound = { taxonA: null, taxonB: null };
        //logger.debug("Cleared preloaded images for next round");
    },
};

const pairPreloader = {
    isCollectionSubsetInitialized: false,

    clearPreloadedPair() {
        preloader.preloadedImages.nextPair = null;
        logger.debug("Cleared preloaded pair");

    },

    async preloadForNextPair() {
        if (preloader.isPreloading) return;

        preloader.isPreloading = true;
        try {
            if (!this.isCollectionSubsetInitialized) {
                await pairManager.initializeCollectionSubset();
                this.isCollectionSubsetInitialized = true;
            }

            const newPair = await pairManager.selectRandomPair();
            
            if (newPair) {
                //logger.debug(`Selected pair for preloading: ${newPair.taxonNames[0]} / ${newPair.taxonNames[1]}`);
                await this.preloadPairImages(newPair);
                logger.debug("Preloaded pair:", newPair);
            } else {
                logger.warn("No valid pairs found for preloading");
                preloader.preloadedImages.nextPair = null;
            }
        } catch (error) {
            logger.error("Error preloading next pair:", error);
            preloader.preloadedImages.nextPair = null;
        } finally {
            preloader.isPreloading = false;
            logger.debug("Preloading completed for next pair");
        }
    },

    async preloadPairImages(pair) {
        const [image1URL, image2URL] = await Promise.all([
            imageLoader.fetchDifferentImage(pair.taxonA, null),
            imageLoader.fetchDifferentImage(pair.taxonB, null)
        ]);

        await Promise.all([
            imageLoader.preloadImage(image1URL),
            imageLoader.preloadImage(image2URL)
        ]);

        preloader.preloadedImages.nextPair = {
            pair: pair,
            taxonA: image1URL,
            taxonB: image2URL
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

        // called from 
        // - pairManager.selectPairForLoading()
        // - pairManager.loadImagesForNewPair()
        getPreloadedImagesForNextPair() {
            //logger.trace("getPreloadedImagesForNextPair");
            if (this.hasPreloadedPair()) {
                const imageData = preloader.preloadedImages.nextPair;
                //logger.debug(`Retrieving preloaded pair: ${images.pair.taxonA} / ${images.pair.taxonB}, Pair ID: ${images.pair.pairID}`);
                //logger.debug(`Preloaded images: ${images.taxonA} / ${images.taxonB}`);
                // Don't clear the preloaded images here
                return imageData;
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
            logger.warn("Preloading already in progress, skipping tag-based preload");
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
            pair.taxonA !== currentTaxonImageCollection.pair.taxonA ||
            pair.taxonB !== currentTaxonImageCollection.pair.taxonB;
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

    async preloadPairByID(pairID) {
        try {
            const nextPair = await pairManager.getPairByID(pairID);
            if (nextPair) {
                await this.preloadPairImages(nextPair);
                //logger.debug(`Preloaded pair with ID ${pairID}`);
            } else {
                logger.warn(`Pair with ID ${pairID} not found for preloading`);
            }
        } catch (error) {
            logger.error(`Error preloading pair with ID ${pairID}:`, error);
        }
    },
};

const preloader = {
    preloadedImages: {
        nextRound: { taxonA: null, taxonB: null },
        nextPair: { taxonA: null, taxonB: null, pair: null }
    },
    isPreloading: false,

    imageLoader,
    roundPreloader,
    pairPreloader,

    async preloadRound(isNewPair) {
        try {
            await this.roundPreloader.preloadForNextRound();
            logger.debug("Preloading completed for next round");
        } catch (error) {
            logger.error("Error during round preloading:", error);
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
    //startPreloading: preloader.startPreloading.bind(preloader),
    pairPreloader: {
        clearPreloadedPair: preloader.pairPreloader.clearPreloadedPair,
        getPreloadedImagesForNextPair: preloader.pairPreloader.getPreloadedImagesForNextPair,
        hasPreloadedPair: preloader.pairPreloader.hasPreloadedPair,
        isPairValid: preloader.pairPreloader.isPairValid,
        preloadNewPairWithTags: preloader.pairPreloader.preloadNewPairWithTags,
        preloadPairByID: preloader.pairPreloader.preloadPairByID,
        preloadForNextPair: preloader.pairPreloader.preloadForNextPair,
    },
    roundPreloader: {
        getPreloadedImagesForNextRound: preloader.roundPreloader.getPreloadedImagesForNextRound,
        getPreloadedImagesForRoundDemo: preloader.roundPreloader.getPreloadedImagesForRoundDemo,
        clearPreloadedImagesForNextRound: preloader.roundPreloader.clearPreloadedImagesForNextRound,
        preloadForNextRound: preloader.roundPreloader.preloadForNextRound,
    },
    imageLoader: {
        fetchDifferentImage: preloader.imageLoader.fetchDifferentImage,
    }
};

export default publicAPI;
