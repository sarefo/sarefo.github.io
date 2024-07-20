// preloader.js
import api from './api.js';
import { gameState, updateGameState } from './state.js';
import logger from './logger.js';
import utils from './utils.js';

const preloader = {
    isPreloading: false,

    async preloadNextPair() {
        if (this.isPreloading) return;

        this.isPreloading = true;
        logger.debug("Starting to preload next pair");

        try {
            const newPair = await utils.selectTaxonPair();
            logger.debug(`Preloading images for taxon pair: ${newPair.taxon1} and ${newPair.taxon2}`);

            const [imageOneURLs, imageTwoURLs, imageOneVernacular, imageTwoVernacular] = await Promise.all([
                api.fetchMultipleImages(newPair.taxon1),
                api.fetchMultipleImages(newPair.taxon2),
                api.fetchVernacular(newPair.taxon1),
                api.fetchVernacular(newPair.taxon2)
            ]);

            updateGameState({
                preloadedTaxonImageCollection: {
                    pair: newPair,
                    imageOneURLs,
                    imageTwoURLs,
                    imageOneVernacular,
                    imageTwoVernacular
                }
            });

            await this.preloadImages(imageOneURLs.concat(imageTwoURLs));
            logger.debug("Finished preloading next pair");
        } catch (error) {
            logger.error("Error preloading next pair:", error);
        } finally {
            this.isPreloading = false;
        }
    },

    async preloadImages(urls) {
        logger.debug(`Starting to preload ${urls.length} images`);
        const preloadPromises = urls.map(url => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    logger.debug(`Preloaded image: ${url}`);
                    resolve();
                };
                img.onerror = () => {
                    logger.error(`Failed to preload image: ${url}`);
                    reject();
                };
                img.src = url;
            });
        });
        await Promise.all(preloadPromises);
        logger.debug("Finished preloading all images");
    }

};

export default preloader;
