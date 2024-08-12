import api from './api.js';
import { gameState, updateGameState } from './state.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import setManager from './setManager.js';

const preloader = {
    preloadedImages: {
        nextRound: { taxon1: null, taxon2: null },
        nextPair: { taxon1: null, taxon2: null, pair: null }
    },

    async startPreloading(isNewPair) {
        try {
            await preloader.preloadForNextRound();
            if (isNewPair || !preloader.hasPreloadedPair()) {
                await preloader.preloadForNextPair();
            }
            logger.debug("Preloading completed for next round" + (isNewPair ? " and next pair" : ""));
        } catch (error) {
            logger.error("Error during preloading:", error);
            // Optionally, you could reset the preloaded state here
            // preloader.preloadedImages.nextPair = null;
        }
    },

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve(url);
            };
            img.onerror = () => {
                logger.error(`Failed to load image: ${url}`);
                reject(url);
            };
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
        logger.debug("Preloaded images for next round:", this.preloadedImages.nextRound);
    },

    async fetchDifferentImage(taxonName, currentImageURL) {
        const images = await api.images.fetchMultipleImages(taxonName, 12);
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
        const matchesLevel = selectedLevel === '' || pair.level === selectedLevel;

        if (!matchesLevel) {
            logger.debug(`Pair invalid - Skill level mismatch: Pair ${pair.level}, Selected ${selectedLevel}`);
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
            logger.debug(`Retrieving preloaded pair: ${images.pair.taxon1} / ${images.pair.taxon2}, Skill Level: ${images.pair.level}`);
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
            const allPairs = await api.taxonomy.fetchTaxonPairs();
            
            // Ensure selectedTags and selectedRanges are arrays, and selectedLevel is a string
            const tags = Array.isArray(selectedTags) ? selectedTags : [];
            const ranges = Array.isArray(selectedRanges) ? selectedRanges : [];
            const level = typeof selectedLevel === 'string' ? selectedLevel : '';

            // Filter pairs based on criteria
            const filteredPairs = allPairs.filter(pair => {
                const matchesLevel = level === '' || pair.level === level;
                const matchesRanges = ranges.length === 0 || 
                    (pair.range && pair.range.some(range => ranges.includes(range)));
                const matchesTags = tags.length === 0 || 
                    (pair.tags && pair.tags.some(tag => tags.includes(tag)));
                const isDifferentFromCurrent = !gameState.currentTaxonImageCollection ||
                    !gameState.currentTaxonImageCollection.pair ||
                    pair.taxon1 !== gameState.currentTaxonImageCollection.pair.taxon1 ||
                    pair.taxon2 !== gameState.currentTaxonImageCollection.pair.taxon2;

                return matchesLevel && matchesRanges && matchesTags && isDifferentFromCurrent;
            });

            let newPair;
            if (filteredPairs.length > 0) {
                newPair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
                logger.debug("Selected new pair matching criteria");
            } else {
                newPair = allPairs[Math.floor(Math.random() * allPairs.length)];
                logger.warn("No pairs match the criteria. Selected a random pair from all pairs.");
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

    async preloadSetByID(setID) {
        try {
            const nextPair = await setManager.getSetByID(setID);
            if (nextPair) {
                const [imageOneURL, imageTwoURL] = await Promise.all([
                    this.fetchDifferentImage(nextPair.taxon1, null),
                    this.fetchDifferentImage(nextPair.taxon2, null)
                ]);

                await Promise.all([
                    this.preloadImage(imageOneURL),
                    this.preloadImage(imageTwoURL)
                ]);

                this.preloadedImages.nextPair = {
                    pair: nextPair,
                    taxon1: imageOneURL,
                    taxon2: imageTwoURL
                };
                logger.debug(`Preloaded set with ID ${setID}`);
            } else {
                logger.warn(`Set with ID ${setID} not found for preloading`);
            }
        } catch (error) {
            logger.error(`Error preloading set with ID ${setID}:`, error);
        }
    },

};

export default preloader;
