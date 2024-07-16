// preloader.js
import api from './api.js';
import { gameState, updateGameState } from './state.js';

const preloader = {
    isPreloading: false,

    async preloadNextPair() {
        if (this.isPreloading) return;
        
        this.isPreloading = true;
        console.log("Starting to preload next pair");

        try {
            const newPair = await this.selectTaxonPair();
            console.log(`Preloading images for taxon pair: ${newPair.taxon1} and ${newPair.taxon2}`);
            
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
            console.log("Finished preloading next pair");
        } catch (error) {
            console.error("Error preloading next pair:", error);
        } finally {
            this.isPreloading = false;
        }
    },

    async selectTaxonPair() {
        const taxonPairs = await api.fetchTaxonPairs();
        if (taxonPairs.length === 0) {
            console.error("No taxon pairs available");
            return null;
        }
        return taxonPairs[Math.floor(Math.random() * taxonPairs.length)];
    },

    async preloadImages(urls) {
        console.log(`Starting to preload ${urls.length} images`);
        const preloadPromises = urls.map(url => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    console.log(`Preloaded image: ${url}`);
                    resolve();
                };
                img.onerror = () => {
                    console.error(`Failed to preload image: ${url}`);
                    reject();
                };
                img.src = url;
            });
        });
        await Promise.all(preloadPromises);
        console.log("Finished preloading all images");
    }

};

export default preloader;
