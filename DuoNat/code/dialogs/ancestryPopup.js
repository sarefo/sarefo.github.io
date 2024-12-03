import api from '../api.js';
import state from '../state.js';
import utils from '../utils.js';

import collectionManager from './collectionManager.js';
import dialogManager from './dialogManager.js';
import phylogenySelector from './phylogenySelector.js';

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
        const taxonElement = document.getElementById('ancestry-popup-title');
        const vernacularElement = document.getElementById('ancestry-popup-vernacular');
        const wikiButton = document.getElementById('ancestry-popup-wiki');

        // Format taxon name based on rank
        taxonElement.innerHTML = this.formatTaxonName(taxon);
        vernacularElement.textContent = taxon.vernacularName && taxon.vernacularName !== "-" ? 
            `(${taxon.vernacularName})` : '';
        
        // Start with Wikipedia button enabled
        this.toggleButtonState(wikiButton, true);
        
        this.currentTaxon = taxon;
        popup.showModal();

        // Check Wikipedia availability asynchronously
        this.checkWikipediaAvailability(taxon.taxonName, wikiButton);
    },

    formatTaxonName(taxon) {
        const rank = taxon.rank.toLowerCase();
        const name = taxon.taxonName;

        if (rank === 'species') {
            // For species, italicize the whole name
            return `<i>${name}</i>`;
        } else if (rank === 'genus') {
            // For genus, just italicize
            return `<i>${name}</i>`;
        } else {
            // For higher ranks, include the rank name and don't italicize
            return `${utils.string.capitalizeFirstLetter(rank)} ${name}`;
        }
    },

    async checkWikipediaAvailability(taxonName, wikiButton) {
        try {
            const hasWikipediaPage = await api.externalAPIs.checkWikipediaPage(taxonName);
            if (!hasWikipediaPage) {
                this.toggleButtonState(wikiButton, false);
            }
        } catch (error) {
            console.warn('Failed to check Wikipedia availability:', error);
            this.toggleButtonState(wikiButton, false);
        }
    },

    closePopup() {
        const popup = document.getElementById('ancestry-popup');
        popup.close();
    },

    openInaturalist() {
        if (this.currentTaxon) {
            window.open(`https://www.inaturalist.org/taxa/${this.currentTaxon.id}`, '_blank');
        }
        this.closePopup();
    },

    toggleButtonState(button, isEnabled) {
        if (isEnabled) {
            button.classList.remove('ancestry-popup__button--inactive');
            button.disabled = false;
        } else {
            button.classList.add('ancestry-popup__button--inactive');
            button.disabled = true;
        }
    },

    async openWikipedia() {
        if (this.currentTaxon) {
            const wikiButton = document.getElementById('ancestry-popup-wiki');
            if (!wikiButton.disabled) {
                window.open(`https://en.wikipedia.org/wiki/${this.currentTaxon.taxonName}`, '_blank');
            }
        }
        this.closePopup();
    },

    filterHere() {
        if (this.currentTaxon) {
            state.setPhylogenyID(this.currentTaxon.id);
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
