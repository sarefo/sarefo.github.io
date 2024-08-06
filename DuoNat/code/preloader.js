import api from './api.js';
import { gameState, updateGameState } from './state.js';
import gameLogic from './gameLogic.js';
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
        if (this.isPreloading) return;
        
        this.isPreloading = true;
        try {
            const newPair = await gameLogic.selectRandomPairFromCurrentCollection();
            if (newPair) {
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
            }
        } catch (error) {
            logger.error("Error preloading next pair:", error);
            this.preloadedImages.nextPair = null;
        } finally {
            this.isPreloading = false;
        }
    },

    isPairValid(pair) {
        const selectedLevel = gameState.selectedLevel;
        const matchesLevel = selectedLevel === '' || pair.skillLevel === selectedLevel;
        
        if (!matchesLevel) {
            logger.debug(`Pair invalid - Skill level mismatch: Pair ${pair.skillLevel}, Selected ${selectedLevel}`);
        }
        
        return matchesLevel; // Simplified for now to focus on skill level
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
        if (this.hasPreloadedPair()) {
            const images = this.preloadedImages.nextPair;
            logger.debug(`Retrieving preloaded pair: ${images.pair.taxon1} / ${images.pair.taxon2}, Skill Level: ${images.pair.skillLevel}`);
            this.preloadedImages.nextPair = null;
            return images;
        } else {
            logger.debug("No preloaded pair available");
            return null;
        }
    },

    hasPreloadedPair() {
        return this.preloadedImages.nextPair != null && this.preloadedImages.nextPair.pair != null;
    },

    async preloadNewPairWithTags(selectedTags, selectedLevel, selectedRanges) {
        if (this.isPreloading) {
            logger.debug("Preloading already in progress, skipping tag-based preload");
            return;
        }

    this.isPreloading = true;
    logger.debug(`Preloading with selected tags: ${selectedTags}, level: ${selectedLevel}, and ranges: ${selectedRanges}`);
    try {
        let newPair;
        let attempts = 0;
        const maxAttempts = 10;

        do {
            newPair = await utils.selectTaxonPair();
            attempts++;

            if (!newPair) {
                logger.warn("No pair found matching selected criteria");
                return;
            }

            const isSamePair = gameState.currentTaxonImageCollection &&
                newPair.taxon1 === gameState.currentTaxonImageCollection.pair.taxon1 &&
                newPair.taxon2 === gameState.currentTaxonImageCollection.pair.taxon2;

            const matchesLevel = selectedLevel === '' || newPair.skillLevel === selectedLevel;
            const matchesRanges = !selectedRanges || selectedRanges.length === 0 || 
                (newPair.range && newPair.range.some(range => selectedRanges.includes(range)));

            if ((!isSamePair && matchesLevel && matchesRanges) || attempts >= maxAttempts) {
                break;
            }

            logger.debug("Selected pair doesn't match criteria, trying again");
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
            logger.debug("Preloaded new pair based on selected tags, level, and ranges");
        } catch (error) {
            logger.error("Error preloading new pair with tags, level, and ranges:", error);
        } finally {
            this.isPreloading = false;
        }
    },

};

export default preloader;
