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
    isPreloading: false,

    imageLoader: {
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
    },

    roundPreloader: {
        async preloadForNextRound() {
            const { pair, imageOneURL, imageTwoURL } = gameState.currentTaxonImageCollection;
            const [newImageOneURL, newImageTwoURL] = await Promise.all([
                preloader.imageLoader.fetchDifferentImage(pair.taxon1, imageOneURL),
                preloader.imageLoader.fetchDifferentImage(pair.taxon2, imageTwoURL)
            ]);

            await Promise.all([
                preloader.imageLoader.preloadImage(newImageOneURL),
                preloader.imageLoader.preloadImage(newImageTwoURL)
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
        }
    },

    pairPreloader: {
        async preloadForNextPair() {
            if (preloader.isPreloading) return;

            preloader.isPreloading = true;
            try {
                const newPair = await gameLogic.selectRandomPairFromCurrentCollection();
                if (newPair) {
                    const [imageOneURL, imageTwoURL] = await Promise.all([
                        preloader.imageLoader.fetchDifferentImage(newPair.taxon1, null),
                        preloader.imageLoader.fetchDifferentImage(newPair.taxon2, null)
                    ]);

                    await Promise.all([
                        preloader.imageLoader.preloadImage(imageOneURL),
                        preloader.imageLoader.preloadImage(imageTwoURL)
                    ]);

                    preloader.preloadedImages.nextPair = {
                        pair: newPair,
                        taxon1: imageOneURL,
                        taxon2: imageTwoURL
                    };
                }
            } catch (error) {
                logger.error("Error preloading next pair:", error);
                preloader.preloadedImages.nextPair = null;
            } finally {
                preloader.isPreloading = false;
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
                    preloader.imageLoader.fetchDifferentImage(newPair.taxon1, null),
                    preloader.imageLoader.fetchDifferentImage(newPair.taxon2, null)
                ]);

                await Promise.all([
                    preloader.imageLoader.preloadImage(imageOneURL),
                    preloader.imageLoader.preloadImage(imageTwoURL)
                ]);

                preloader.preloadedImages.nextPair = {
                    pair: newPair,
                    taxon1: imageOneURL,
                    taxon2: imageTwoURL
                };
                logger.debug("Preloaded new pair based on selected tags, level, and ranges");
            } catch (error) {
                logger.error("Error preloading new pair with tags, level, and ranges:", error);
            } finally {
                preloader.isPreloading = false;
            }
        },

        async preloadSetByID(setID) {
            try {
                const nextPair = await setManager.getSetByID(setID);
                if (nextPair) {
                    const [imageOneURL, imageTwoURL] = await Promise.all([
                        preloader.imageLoader.fetchDifferentImage(nextPair.taxon1, null),
                        preloader.imageLoader.fetchDifferentImage(nextPair.taxon2, null)
                    ]);

                    await Promise.all([
                        preloader.imageLoader.preloadImage(imageOneURL),
                        preloader.imageLoader.preloadImage(imageTwoURL)
                    ]);

                    preloader.preloadedImages.nextPair = {
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
    },

    async startPreloading(isNewPair) {
        try {
            await preloader.roundPreloader.preloadForNextRound();
            if (isNewPair || !preloader.pairPreloader.hasPreloadedPair()) {
                await preloader.pairPreloader.preloadForNextPair();
            }
            logger.debug("Preloading completed for next round" + (isNewPair ? " and next pair" : ""));
        } catch (error) {
            logger.error("Error during preloading:", error);
            // Optionally, you could reset the preloaded state here
            // preloader.preloadedImages.nextPair = null;
        }
    },

};

export default preloader;
