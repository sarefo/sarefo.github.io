import api from './api.js';
import state from './state.js';
import logger from './logger.js';

const hintSystem = {
    initialize() {
        this.addHintButtonListeners();
    },

    addHintButtonListeners() {
        const safeAddEventListener = (id, eventType, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(eventType, handler);
            } else {
                logger.debug(`Element with id '${id}' not found. Skipping event listener.`);
            }
        };

        safeAddEventListener('hint-button-1', 'click', () => this.showHint(1));
        safeAddEventListener('hint-button-2', 'click', () => this.showHint(2));
    },

    async showHint(index) {
        const imageContainer = document.getElementById(`image-container-${index}`);
        const taxonName = imageContainer.querySelector('img').alt.split(' Image')[0];
        const taxonId = await this.getTaxonId(taxonName);
        
        if (!taxonId) {
            logger.warn(`Could not find ID for taxon: ${taxonName}`);
            return;
        }
        
        const hints = await api.taxonomy.fetchTaxonHints(taxonId);
        
        if (hints && hints.length > 0) {
            this.displayRandomHint(hints, index);
        } else {
            logger.warn(`No hints available for ${taxonName} (ID: ${taxonId})`);
        }
    },

    async getTaxonId(taxonName) {
        const taxonInfo = await api.taxonomy.loadTaxonInfo();
        return Object.keys(taxonInfo).find(id => taxonInfo[id].taxonName === taxonName);
    },

    displayRandomHint(hints, index) {
        if (state.areAllHintsShown(index, hints.length)) {
            state.resetShownHints();
        }
        
        const shownHints = state.getShownHints(index);
        const availableHints = hints.filter(hint => !shownHints.includes(hint));
        
        if (availableHints.length > 0) {
            const randomHint = availableHints[Math.floor(Math.random() * availableHints.length)];
            state.addShownHint(index, randomHint);
            
            this.showHintOverlay(randomHint, index);
        }
    },

    showHintOverlay(hint, index) {
        const imageContainer = document.getElementById(`image-container-${index}`);
        const hintOverlay = document.createElement('div');
        hintOverlay.className = 'hint-overlay';
        hintOverlay.textContent = hint;
        
        imageContainer.appendChild(hintOverlay);
        
        setTimeout(() => {
            hintOverlay.remove();
        }, 3000);
    }
};

export default hintSystem;
