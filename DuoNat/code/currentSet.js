
import { CurrentPair } from './currentPair.js';

export class CurrentSet {
    constructor(taxa) {
        this.taxa = taxa; // Array of taxon names
        this.vernacularNames = {};
        this.images = {};
        this.currentPair = null;
    }

    async initialize(api) {
        // Fetch vernacular names and images for all taxa in the set
        for (let taxon of this.taxa) {
            this.vernacularNames[taxon] = await api.fetchVernacular(taxon);
            this.images[taxon] = await api.fetchMultipleImages(taxon, 12);
        }
    }

    getRandomPair() {
        if (this.taxa.length < 2) {
            throw new Error("Not enough taxa in the set to form a pair");
        }

        let taxon1, taxon2;
        do {
            taxon1 = this.taxa[Math.floor(Math.random() * this.taxa.length)];
            taxon2 = this.taxa[Math.floor(Math.random() * this.taxa.length)];
        } while (taxon1 === taxon2);

        this.currentPair = new CurrentPair(taxon1, taxon2);
        this.currentPair.vernacularNames = {
            [taxon1]: this.vernacularNames[taxon1],
            [taxon2]: this.vernacularNames[taxon2]
        };
        this.currentPair.images = {
            taxon1: this.images[taxon1],
            taxon2: this.images[taxon2]
        };

        return this.currentPair;
    }

    getVernacularName(taxon) {
        return this.vernacularNames[taxon] || '';
    }

    getTaxonImages(taxon) {
        return this.images[taxon] || [];
    }
}
