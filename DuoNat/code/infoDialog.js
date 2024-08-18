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

    initializeInfoButtons() {
        const infoButton1 = document.getElementById('info-button-1');
        const infoButton2 = document.getElementById('info-button-2');

        infoButton1.addEventListener('click', () => this.handleInfoButtonClick(1));
        infoButton2.addEventListener('click', () => this.handleInfoButtonClick(2));

        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    },

    handleInfoButtonClick(imageIndex) {
        const imageURL = state.getObservationURL(imageIndex);
        if (!imageURL) {
            logger.error(`Info button ${imageIndex} clicked, but image URL is null or undefined`);
            return;
        }
        this.showInfoDialog(imageURL, imageIndex);
    },

    handleKeyboardShortcuts(event) {
        if (event.key === 'i' || event.key === 'I') {
            this.handleInfoButtonClick(1);
        } else if (event.key === 'o' || event.key === 'O') {
            this.handleInfoButtonClick(2);
        }
    },

    setupInfoDialogCloseHandler() {
        document.getElementById('info-dialog').addEventListener('close', this.handleDialogClose);
    },

    async showInfoDialog(url, imageIndex) {
        if (!url) {
            logger.error(`showInfoDialog: URL is null or undefined for imageIndex: ${imageIndex}`);
            return;
        }

        const currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
        if (!currentTaxonImageCollection) {
            logger.error('showInfoDialog: currentTaxonImageCollection is null or undefined');
            return;
        }

        const currentTaxon = imageIndex === 1 ? currentTaxonImageCollection.pair.taxon1 : currentTaxonImageCollection.pair.taxon2;
        if (!currentTaxon) {
            logger.error(`showInfoDialog: Unable to get current taxon for imageIndex: ${imageIndex}`);
            return;
        }

        const dialog = document.getElementById('info-dialog');
        this.frameImage(imageIndex);

        await this.populateDialogContent(currentTaxon);
        this.setupDialogButtons(url, currentTaxon);
        this.positionDialog(dialog, imageIndex);
        this.setupDialogEventListeners(dialog, imageIndex);

        if (!dialog.open) {
            dialog.showModal();
        }
    },

    async populateDialogContent(currentTaxon) {
        const taxonElement = document.getElementById('info-dialog-taxon');
        const vernacularElement = document.getElementById('info-dialog-vernacular');
        const factsElement = document.getElementById('info-dialog-facts');

        taxonElement.textContent = currentTaxon;

        try {
            const vernacularName = await api.vernacular.fetchVernacular(currentTaxon);
            vernacularElement.textContent = vernacularName;

            await this.populateTaxonFacts(currentTaxon, factsElement);
        } catch (error) {
            logger.error('Error in populateDialogContent:', error);
        }
    },

    async populateTaxonFacts(currentTaxon, factsElement) {
        const taxonInfo = await api.taxonomy.loadTaxonInfo();
        const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === currentTaxon.toLowerCase());

        if (taxonData && taxonData.taxonFacts && taxonData.taxonFacts.length > 1) {
            factsElement.innerHTML = '<h4>Facts:</h3><ul>' +
                taxonData.taxonFacts.map(fact => `<li>${fact}</li>`).join('') +
                '</ul>';
            factsElement.style.display = 'block';
        } else {
            factsElement.style.display = 'none';
        }
    },

    setupDialogButtons(url, currentTaxon) {
        this.setupPhotoButton(url);
        this.setupObservationButton();
        this.setupTaxonButton(currentTaxon);
        this.setupWikiButton(currentTaxon);
        this.setupReportButton();
    },

    setupPhotoButton(url) {
        const photoButton = document.getElementById('photo-button');
        photoButton.onclick = () => {
            window.open(url, '_blank');
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
        if (utils.device.hasKeyboard()) {
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
            dialog.style.top = `${namePairRect.top}px`;
            dialog.style.bottom = `${window.innerHeight - bottomContainerRect.bottom}px`;
        } else {
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
        infoDialog.removeImageFraming();
    },

    handleDialogClose() {
        infoDialog.removeImageFraming();
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

const publicAPI = {
    initialize: infoDialog.initialize.bind(infoDialog),
    showInfoDialog: infoDialog.showInfoDialog.bind(infoDialog),
};

export default publicAPI;
