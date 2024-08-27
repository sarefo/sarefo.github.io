import api from './api.js';
import collectionManager from './collectionManager.js';
import dialogManager from './dialogManager.js';
import phylogenySelector from './phylogenySelector.js';
import state from './state.js';

const ancestryPopup = {
    initialize() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        const popup = document.getElementById('ancestry-popup');
        popup.querySelector('.dialog-close-button').addEventListener('click', () => this.closePopup());
        document.getElementById('ancestry-popup-inat').addEventListener('click', () => this.openInaturalist());
        document.getElementById('ancestry-popup-wiki').addEventListener('click', () => this.openWikipedia());
        document.getElementById('ancestry-popup-filter').addEventListener('click', () => this.filterHere());
    },

    openPopup(taxon) {
        const popup = document.getElementById('ancestry-popup');
        const taxonElement = document.getElementById('ancestry-popup-taxon');
        const vernacularElement = document.getElementById('ancestry-popup-vernacular');

        taxonElement.textContent = `${taxon.rank} ${taxon.taxonName}`;
        vernacularElement.textContent = taxon.vernacularName && taxon.vernacularName !== "-" ? `(${taxon.vernacularName})` : '';

        this.currentTaxon = taxon;
        popup.showModal();
    },

    closePopup() {
        const popup = document.getElementById('ancestry-popup');
        popup.close();
    },

    async openInaturalist() {
        if (this.currentTaxon) {
            window.open(`https://www.inaturalist.org/taxa/${this.currentTaxon.id}`, '_blank');
        }
        this.closePopup();
    },

    async openWikipedia() {
        if (this.currentTaxon) {
            const hasWikipediaPage = await api.externalAPIs.checkWikipediaPage(this.currentTaxon.taxonName);
            if (hasWikipediaPage) {
                window.open(`https://en.wikipedia.org/wiki/${this.currentTaxon.taxonName}`, '_blank');
            } else {
                alert('No Wikipedia page found for this taxon.');
            }
        }
        this.closePopup();
    },

    filterHere() {
        if (this.currentTaxon) {
            state.setPhylogenyId(this.currentTaxon.id);
            phylogenySelector.updateGraph();
        }
        this.closePopup();
        dialogManager.closeDialog('ancestry-dialog');
        collectionManager.openCollectionManagerDialog();
    }
};

// Bind all methods and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};

bindMethodsRecursively(ancestryPopup);

const publicAPI = {
    initialize: ancestryPopup.initialize,
    openPopup: ancestryPopup.openPopup,
};

Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(ancestryPopup);
    }
});

export default publicAPI;

