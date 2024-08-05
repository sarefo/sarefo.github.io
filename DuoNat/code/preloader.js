import api from './api.js';
import { gameState, updateGameState } from './state.js';
import logger from './logger.js';
import utils from './utils.js';

const preloader = {
    preloadedImages: {
        nextRound: { taxon1: null, taxon2: null },
        nextPair: { taxon1: null, taxon2: null, pair: null }
    },

    async preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    },

    async preloadForNextRound() {
        const { pair, imageOneURL, imageTwoURL } = gameState.currentTaxonImageCollection;
        const [newImageOneURL, newImageTwoURL] = await Promise.all([
            this.fetchDifferentImage(pair.taxon1, imageOneURL),
            this.fetchDifferentImage(pair.taxon2, imageTwoURL)
        ]);

        await Promise.all([
            this.preloadImage(newImageOneURL),
            this.preloadImage(newImageTwoURL)
        ]);

        this.preloadedImages.nextRound = { taxon1: newImageOneURL, taxon2: newImageTwoURL };
//        logger.debug("Preloaded images for next round:", this.preloadedImages.nextRound);
    },

    async fetchDifferentImage(taxonName, currentImageURL) {
        const images = await api.fetchMultipleImages(taxonName, 12);
        let usedImages;

        if (gameState.currentTaxonImageCollection) {
            const taxonKey = taxonName === gameState.currentTaxonImageCollection.pair.taxon1 ? 'taxon1' : 'taxon2';
            usedImages = gameState.usedImages[taxonKey];
        } else {
            usedImages = new Set();
        }

        // Filter out the current image and any previously used images
        let availableImages = images.filter(img => !usedImages.has(img) && img !== currentImageURL);

        // If we've used all images, reset the used images but still avoid the current image
        if (availableImages.length === 0) {
            logger.warn(`All images for ${taxonName} have been used. Resetting used images.`);
            usedImages = new Set(currentImageURL ? [currentImageURL] : []);
            availableImages = images.filter(img => img !== currentImageURL);
        }

        if (availableImages.length > 0) {
            const selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
            usedImages.add(selectedImage);
            if (gameState.currentTaxonImageCollection) {
                const taxonKey = taxonName === gameState.currentTaxonImageCollection.pair.taxon1 ? 'taxon1' : 'taxon2';
                updateGameState({
                    usedImages: {
                        ...gameState.usedImages,
                        [taxonKey]: usedImages
                    }
                });
            }
            return selectedImage;
        } else {
            // This should rarely happen, but just in case
            logger.error(`No available images found for ${taxonName}. Using current image.`);
            return currentImageURL || images[0]; // Return the first image if no current image
        }
    },

    async preloadForNextPair() {
        if (this.hasPreloadedPair()) {
            logger.debug("Already have a preloaded pair, skipping preload");
            return;
        }

        logger.debug("Starting preload for next pair");
        
        try {
            let newPair;
            let attempts = 0;
            const maxAttempts = 3;

            do {
                newPair = await utils.selectTaxonPair();
                attempts++;

                const isSamePair = gameState.currentTaxonImageCollection &&
                    newPair.taxon1 === gameState.currentTaxonImageCollection.pair.taxon1 &&
                    newPair.taxon2 === gameState.currentTaxonImageCollection.pair.taxon2;

                if (!isSamePair || attempts >= maxAttempts) {
                    break;
                }

                logger.debug("Selected pair is the same as current, trying again");
            } while (true);

            if (attempts >= maxAttempts) {
                logger.warn("Reached max attempts to find a different pair. Using the last selected pair.");
            }

            logger.debug("Selected new pair for preloading:", newPair);

            const [imageOneURL, imageTwoURL] = await Promise.all([
                this.fetchDifferentImage(newPair.taxon1, null),
                this.fetchDifferentImage(newPair.taxon2, null)
            ]);

            await Promise.all([
                this.preloadImage(imageOneURL),
                this.preloadImage(imageTwoURL)
            ]);

            this.preloadedImages.nextPair = {
                pair: newPair,
                taxon1: imageOneURL,
                taxon2: imageTwoURL
            };
//            logger.debug(`Preloaded images for next pair: ${newPair.taxon1} / ${newPair.taxon2}`);
        } catch (error) {
            logger.error("Error preloading next pair:", error);
        }
    },

    getPreloadedImagesForNextRound() {
        const images = this.preloadedImages.nextRound;
        this.preloadedImages.nextRound = { taxon1: null, taxon2: null };
        return images;
    },

    clearPreloadedImagesForNextRound() {
        this.preloadedImages.nextRound = { taxon1: null, taxon2: null };
        logger.debug("Cleared preloaded images for next round");
    },

    getPreloadedImagesForNextPair() {
        const images = { ...this.preloadedImages.nextPair };
        this.preloadedImages.nextPair = { taxon1: null, taxon2: null, pair: null };
        return images;
    },

    hasPreloadedPair() {
        return !!this.preloadedImages.nextPair.pair;
    },

    async preloadNewPairWithTags(selectedTags, selectedLevel) {
        if (this.isPreloading) {
            logger.debug("Preloading already in progress, skipping tag-based preload");
            return;
        }

        this.isPreloading = true;
        logger.debug(`Preloading with selected tags: ${selectedTags} and level: ${selectedLevel}`);
        try {
            let newPair;
            let attempts = 0;
            const maxAttempts = 10;

            do {
                newPair = await utils.selectTaxonPair();
                attempts++;

                if (!newPair) {
                    logger.warn("No pair found matching selected tags and level");
                    return;
                }

                const isSamePair = gameState.currentTaxonImageCollection &&
                    newPair.taxon1 === gameState.currentTaxonImageCollection.pair.taxon1 &&
                    newPair.taxon2 === gameState.currentTaxonImageCollection.pair.taxon2;

                const matchesLevel = selectedLevel === '' || newPair.skillLevel === selectedLevel;

                if ((!isSamePair && matchesLevel) || attempts >= maxAttempts) {
                    break;
                }

                logger.debug("Selected pair is the same as current or doesn't match level, trying again");
            } while (true);

            if (attempts >= maxAttempts) {
                logger.warn("Reached max attempts to find a different pair. Using the last selected pair.");
            }

            const [imageOneURL, imageTwoURL] = await Promise.all([
                this.fetchDifferentImage(newPair.taxon1, null),
                this.fetchDifferentImage(newPair.taxon2, null)
            ]);

            await Promise.all([
                this.preloadImage(imageOneURL),
                this.preloadImage(imageTwoURL)
            ]);

            this.preloadedImages.nextPair = {
                pair: newPair,
                taxon1: imageOneURL,
                taxon2: imageTwoURL
            };
            logger.debug("Preloaded new pair based on selected tags and level");
        } catch (error) {
            logger.error("Error preloading new pair with tags and level:", error);
        } finally {
            this.isPreloading = false;
        }
    },

};

export default preloader;
