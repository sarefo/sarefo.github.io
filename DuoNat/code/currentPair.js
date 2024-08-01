export class CurrentPair {
    constructor(taxon1, taxon2) {
        this.taxon1 = taxon1;
        this.taxon2 = taxon2;
        this.vernacularNames = {};
        this.images = {
            taxon1: [],
            taxon2: []
        };
        this.currentRound = {
            imageOneURL: null,
            imageTwoURL: null,
            randomized: false
        };
    }

    async initializeVernacularNames(api) {
        this.vernacularNames[this.taxon1] = await api.fetchVernacular(this.taxon1);
        this.vernacularNames[this.taxon2] = await api.fetchVernacular(this.taxon2);
    }

    fetchVernacular(taxon) {
        return this.vernacularNames[taxon] || '';
    }

    async loadImages(api, count = 12) {
        this.images.taxon1 = await api.fetchMultipleImages(this.taxon1, count);
        this.images.taxon2 = await api.fetchMultipleImages(this.taxon2, count);
    }

    setupNewRound() {
        this.currentRound.randomized = Math.random() < 0.5;
        this.currentRound.imageOneURL = this.getRandomImage(this.currentRound.randomized ? this.taxon1 : this.taxon2);
        this.currentRound.imageTwoURL = this.getRandomImage(this.currentRound.randomized ? this.taxon2 : this.taxon1);
    }

    getRandomImage(taxon) {
        const images = taxon === this.taxon1 ? this.images.taxon1 : this.images.taxon2;
        return images[Math.floor(Math.random() * images.length)];
    }

    setDataFromSet(vernacularNames, images) {
        this.vernacularNames = vernacularNames;
        this.images = images;
    }
}
