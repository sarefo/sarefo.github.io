import config from './config.js';
import logger from './logger.js';
import state from './state.js';

import api from './api.js';

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
                //logger.debug(`Element with id '${id}' not found. Skipping event listener.`);
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
        if (config.useMongoDB) {
            //logger.trace("trying to get taxonID from MongoDB in hintSystem.js");
            const taxonInfo = await api.taxonomy.fetchTaxonInfoFromMongoDB(taxonName);
            return taxonInfo ? taxonInfo.taxonId : null;
        } else {
            const taxonInfo = await api.taxonomy.loadTaxonInfo();
            return Object.keys(taxonInfo).find(id => taxonInfo[id].taxonName === taxonName);
        }
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
        hintOverlay.innerHTML = `(Demo only!)<br>${hint}`;

        imageContainer.appendChild(hintOverlay);

        setTimeout(() => {
            hintOverlay.remove();
        }, 2000);
    },

    async updateHintButtonState(index) {
        const hintButton = document.getElementById(`hint-button-${index}`);
        if (!hintButton) return;

        const imageContainer = document.getElementById(`image-container-${index}`);
        const taxonName = imageContainer.querySelector('img').alt.split(' Image')[0];
        const taxonId = await this.getTaxonId(taxonName);

        if (!taxonId) {
            logger.warn(`Could not find ID for taxon: ${taxonName}`);
            this.disableHintButton(hintButton);
            return;
        }

        const hints = await api.taxonomy.fetchTaxonHints(taxonId);

        if (hints && hints.length > 0) {
            this.enableHintButton(hintButton);
        } else {
            this.disableHintButton(hintButton);
        }
    },

    enableHintButton(button) {
        button.classList.remove('inactive');
        button.disabled = false;
    },

    disableHintButton(button) {
        button.classList.add('inactive');
        button.disabled = true;
    },

    async updateAllHintButtons() {
        await this.updateHintButtonState(1);
        await this.updateHintButtonState(2);
    }

};

// Bind all methods in hintSystem
Object.keys(hintSystem).forEach(key => {
    if (typeof hintSystem[key] === 'function') {
        hintSystem[key] = hintSystem[key].bind(hintSystem);
    }
});

const publicAPI = {
    initialize: hintSystem.initialize,
    showHint: hintSystem.showHint,
    updateAllHintButtons: hintSystem.updateAllHintButtons,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(hintSystem);
    }
});

export default publicAPI;
