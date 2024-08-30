import api from './api.js';
import dialogManager from './dialogManager.js';
import logger from './logger.js';
import state from './state.js';
import utils from './utils.js';
import ui from './ui.js';

const infoDialog = {
    initialize() {
        this.initializeInfoButtons();
        this.setupInfoDialogCloseHandler();
        this.addKeyboardClass();
        this.addInfoDialogKeyListener();
    },

    setupInfoDialogCloseHandler() {
        document.getElementById('info-dialog').addEventListener('close', this.handleDialogClose);
    },

    initializeInfoButtons() {
        const infoButton1 = document.getElementById('info-button-1');
        const infoButton2 = document.getElementById('info-button-2');

        infoButton1.addEventListener('click', () => this.showInfoDialog(1));
        infoButton2.addEventListener('click', () => this.showInfoDialog(2));

    },

    async showInfoDialog(imageIndex) {

        // TODO hacky way to get the taxon name from the correct image
        const imageContainer = document.getElementById(`image-container-${imageIndex}`);
        const currentTaxon = imageContainer.querySelector('img').alt.split(' Image')[0];

        const dialog = document.getElementById('info-dialog');
        this.frameImage(imageIndex);

        await this.populateDialogContent(currentTaxon);
        this.setupDialogButtons(currentTaxon, imageIndex);
        this.positionDialog(dialog, imageIndex);
        this.setupDialogEventListeners(dialog, imageIndex);

        if (!dialog.open) {
            dialog.showModal();
        }
    },

    async populateDialogContent(taxonName) {
        const taxonElement = document.getElementById('info-dialog-taxon');
        const vernacularElement = document.getElementById('info-dialog-vernacular');
        const factsElement = document.getElementById('info-dialog-facts');

        taxonElement.textContent = taxonName;

        try {
            const vernacularName = await api.vernacular.fetchVernacular(taxonName);
            if (vernacularName && vernacularName !== "-") {
                vernacularElement.textContent = vernacularName;
                vernacularElement.style.display = 'block';
            } else {
                vernacularElement.textContent = '';
                vernacularElement.style.display = 'none';
            }

            await this.populateTaxonFacts(taxonName, factsElement);
        } catch (error) {
            logger.error('Error in populateDialogContent:', error);
        }
    },

    async populateTaxonFacts(currentTaxon, factsElement) {
        const taxonInfo = await api.taxonomy.loadTaxonInfo();
        const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === currentTaxon.toLowerCase());

        if (taxonData && taxonData.taxonFacts && taxonData.taxonFacts.length > 0) {
            factsElement.innerHTML = '<h3>Facts:</h3><ul>' +
                taxonData.taxonFacts.map(fact => `<li>${fact}</li>`).join('') +
                '</ul>';
            factsElement.style.display = 'block';
        } else {
            factsElement.style.display = 'none';
        }
    },

    setupDialogButtons(currentTaxon, imageIndex) {
        this.setupPhotoButton(imageIndex);
        this.setupObservationButton();
        this.setupTaxonButton(currentTaxon);
        this.setupWikiButton(currentTaxon);
        this.setupReportButton();
    },

    setupPhotoButton(imageIndex) {
        const photoButton = document.getElementById('photo-button');

        const imageURL = state.getObservationURL(imageIndex);
        if (!imageURL) {
            logger.error(`Info button ${imageIndex} clicked, but image URL is null or undefined`);
            return;
        }

        const photoID = imageURL.split("/").slice(-2, -1)[0];
        const photoURL = `https://www.inaturalist.org/photos/${photoID}`;
        photoButton.onclick = () => {
            window.open(photoURL, '_blank');
            dialogManager.closeDialog('info-dialog');
        };
    },

    setupObservationButton() {
        const observationButton = document.getElementById('observation-button');
        observationButton.onclick = () => {
            logger.debug("Observation button clicked");
            // Implement observation functionality here
        };
    },

    async setupTaxonButton(currentTaxon) {
        const taxonButton = document.getElementById('taxon-button');
        taxonButton.onclick = async () => {
            try {
                const taxonId = await api.taxonomy.fetchTaxonId(currentTaxon);
                window.open(`https://www.inaturalist.org/taxa/${taxonId}`, '_blank');
                dialogManager.closeDialog('info-dialog');
            } catch (error) {
                ui.showPopupNotification("Unable to open taxon page. Please try again.");
            }
        };
    },

    async setupWikiButton(currentTaxon) {
        const wikiButton = document.getElementById('wiki-button');
        const hasWikipediaPage = await api.externalAPIs.checkWikipediaPage(currentTaxon);

        this.toggleButtonState(wikiButton, hasWikipediaPage);

        wikiButton.onclick = () => {
            try {
                window.open(`https://en.wikipedia.org/wiki/${currentTaxon}`, '_blank');
                dialogManager.closeDialog('info-dialog');
            } catch (error) {
                ui.showPopupNotification("Unable to open Wikipedia page. Please try again.");
            }
        };
    },

    setupReportButton() {
        const reportButton = document.getElementById('report-button');
        reportButton.addEventListener('click', () => {
            dialogManager.closeDialog('info-dialog');
            dialogManager.openDialog('report-dialog');
        });
    },

    addInfoDialogKeyListener() {
        const infoDialog = document.getElementById('info-dialog');
        const handleKeyPress = this.createInfoDialogKeyPressHandler(infoDialog);
        document.addEventListener('keydown', handleKeyPress);
    },

    createInfoDialogKeyPressHandler(infoDialog) {
        return (event) => {
            if (!infoDialog.open) return;
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
            if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;

            event.stopPropagation();
            const key = event.key.toLowerCase();
            this.handleInfoDialogKeyPress(key, event, infoDialog);
        };
    },

    handleInfoDialogKeyPress(key, event, infoDialog) {
        const buttonMap = {
            'p': 'photo-button',
            'h': 'hints-button',
            'o': 'observation-button',
            't': 'taxon-button',
            'w': 'wiki-button',
            'r': 'report-button'
        };

        if (buttonMap[key]) {
            event.preventDefault();
            document.getElementById(buttonMap[key]).click();
        } else if (key === 'escape') {
            event.preventDefault();
            infoDialog.close();
        }
    },

    addKeyboardClass() {
        if (state.getHasKeyboard()) {
            document.body.classList.add('has-keyboard');
        }
    },

    toggleButtonState(button, isEnabled) {
        if (isEnabled) {
            button.classList.remove('info-dialog__button--inactive');
            button.disabled = false;
        } else {
            button.classList.add('info-dialog__button--inactive');
            button.disabled = true;
        }
    },

    positionDialog(dialog, imageIndex) {
        const topImageContainer = document.getElementById('image-container-1');
        const bottomImageContainer = document.getElementById('image-container-2');
        const namePairContainer = document.querySelector('.name-pair');

        const dialogRect = dialog.getBoundingClientRect();
        const topContainerRect = topImageContainer.getBoundingClientRect();
        const bottomContainerRect = bottomImageContainer.getBoundingClientRect();
        const namePairRect = namePairContainer.getBoundingClientRect();

        if (imageIndex === 1) {
            // For top image, position dialog over bottom image
            dialog.style.top = `${namePairRect.top}px`;
            dialog.style.bottom = `${window.innerHeight - bottomContainerRect.bottom}px`;
        } else {
            // For bottom image, position dialog over top image
            dialog.style.top = `${topContainerRect.top}px`;
            dialog.style.bottom = `${window.innerHeight - namePairRect.bottom}px`;
        }
        dialog.style.height = 'auto';
    },

    setupDialogEventListeners(dialog, imageIndex) {
        const closeButton = document.getElementById('info-close-button');
        closeButton.onclick = () => this.closeInfoDialog(dialog);

        window.addEventListener('resize', () => this.positionDialog(dialog, imageIndex));
    },

    closeInfoDialog(dialog) {
        dialog.close();
        this.removeImageFraming();
    },

    handleDialogClose() {
        this.removeImageFraming();
    },

    frameImage(imageIndex) {
        if (imageIndex) {
            const imageContainer = document.getElementById(`image-container-${imageIndex}`);
            if (imageContainer) {
                imageContainer.classList.add('image-container--framed');
            }
        }
    },

    removeImageFraming() {
        document.querySelectorAll('.image-container').forEach(container => {
            container.classList.remove('image-container--framed');
        });
    },
};

// Bind all methods in infoDialog
Object.keys(infoDialog).forEach(key => {
    if (typeof infoDialog[key] === 'function') {
        infoDialog[key] = infoDialog[key].bind(infoDialog);
    }
});

const publicAPI = {
    initialize: infoDialog.initialize.bind(infoDialog),
    showInfoDialog: infoDialog.showInfoDialog.bind(infoDialog),
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(infoDialog);
    }
});

export default publicAPI;
