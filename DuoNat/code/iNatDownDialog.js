import api from './api.js';
import logger from './logger.js';
import state from './state.js';
import dialogManager from './dialogManager.js';
import pairManager from './pairManager.js';
import ui from './ui.js';

const iNatDownDialog = {

    showINatDownDialog() {
        this.hideLoadingScreenSpinner();
        this.openINatDownDialog();
        this.setupINatDownDialogButtons();
    },

    hideLoadingScreenSpinner() {
        const loadingScreenSpinner = document.getElementById('loading-screen__spinner');
        if (loadingScreenSpinner) {
            loadingScreenSpinner.style.display = 'none';
        }
    },

    openINatDownDialog() {
        dialogManager.openDialog('inat-down-dialog');
    },

    hideINatDownDialog() {
        dialogManager.closeDialog();
    },

    setupINatDownDialogButtons() {
        const checkStatusBtn = document.getElementById('check-inat-status');
        const retryConnectionBtn = document.getElementById('retry-connection');

        checkStatusBtn.addEventListener('click', this.handleCheckStatus);
        retryConnectionBtn.addEventListener('click', this.handleRetryConnection);
    },

    handleCheckStatus() {
        window.open('https://inaturalist.org', '_blank');
    },

    async handleRetryConnection() {
        if (await api.externalAPIs.isINaturalistReachable()) {
           this.hideINatDownDialog();
           ui.hideLoadingScreen();
           gameSetup.setupGame(true);
           // replace line above with:
           // pairManager.TODOloadNewPair();
        }
    },
};

const bindAllMethods = (obj) => {
    for (let prop in obj) {
        if (typeof obj[prop] === 'function') {
            obj[prop] = obj[prop].bind(obj);
        } else if (typeof obj[prop] === 'object' && obj[prop] !== null) {
            bindAllMethods(obj[prop]);
        }
    }
};

bindAllMethods(iNatDownDialog);

const publicAPI = {
    showINatDownDialog: iNatDownDialog.showINatDownDialog,
    hideINatDownDialog: iNatDownDialog.hideINatDownDialog,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(iNatDownDialog);
    }
});

export default publicAPI;
