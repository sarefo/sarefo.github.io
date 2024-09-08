import logger from './logger.js';
import state from './state.js';
import url from './url.js';

import dialogManager from './dialogs/dialogManager.js';

const sharing = {
    updateShareDialog(shareUrl) {
        this.updateShareLinkInput(shareUrl);
        this.updateQRCode(shareUrl);
        this.createShareOptionToggles(shareUrl);
        this.setupCopyLinkButton();
        this.setupShareOptionListeners();
        dialogManager.openDialog('qr-dialog');
    },

    updateShareLinkInput(shareUrl) {
        const shareLinkInput = document.getElementById('share-link-input');
        shareLinkInput.value = shareUrl;
    },

    updateQRCode(shareUrl) {
        this.qr.generateAndShowQRCode(shareUrl);
    },

    setupCopyLinkButton() {
        const copyLinkButton = document.getElementById('copy-link-button');
        copyLinkButton.onclick = this.handleCopyLinkClick.bind(this);
    },

    handleCopyLinkClick() {
        const shareLinkInput = document.getElementById('share-link-input');
        const currentShareUrl = shareLinkInput.value;
        this.copyToClipboard(currentShareUrl)
            .then(this.showCopySuccessMessage)
            .catch(this.handleShareError);
    },

    showCopySuccessMessage() {
        const shareMessage = document.getElementById('qr-dialog__share-message');
        if (shareMessage) {
            shareMessage.textContent = 'Link copied to clipboard!';
            shareMessage.style.opacity = 1;
            setTimeout(() => {
                shareMessage.style.opacity = 0;
            }, 3000);
        }
    },

    setupShareOptionListeners() {
        const shareOptions = document.querySelectorAll('#share-options-toggles input[type="checkbox"]');
        shareOptions.forEach(option => {
            option.addEventListener('change', this.handleShareOptionChange.bind(this));
        });
    },

    handleShareOptionChange() {
        const newShareUrl = this.generateShareLink();
        this.updateShareLinkInput(newShareUrl);
        this.updateQRCode(newShareUrl);
    },

    copyToClipboard(text) {
        return navigator.clipboard.writeText(text)
            .then(() => logger.info('Share URL copied to clipboard'));
    },

    handleShareError(err) {
        logger.error('Failed to copy:', err);
        alert('Failed to copy link. Please try again.');
    },

    createShareOptionToggles(shareUrl) {
        const shareOptionsToggles = document.getElementById('share-options-toggles');
        shareOptionsToggles.innerHTML = ''; // Clear existing toggles

        const url = new URL(shareUrl);
        const params = url.searchParams;

        const options = [
            /*{ value: 'taxa', label: 'Taxa', isPresent: params.has('taxonA') || params.has('taxonB') },*/
            { value: 'pairID', label: 'Pair ID', isPresent: params.has('pairID') },
            { value: 'tags', label: 'Tags', isPresent: params.has('tags') },
            { value: 'level', label: 'Level', isPresent: params.has('level') },
            { value: 'ranges', label: 'Ranges', isPresent: params.has('ranges') },
            { value: 'phylogenyID', label: 'Phylogeny', isPresent: params.has('phylogenyID') }
        ];

        options.forEach(option => {
            if (option.isPresent) {
                this.createToggle(shareOptionsToggles, option);
            }
        });
    },

    createToggle(container, option) {
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'share-toggle-container';
        toggleContainer.innerHTML = `
            <input type="checkbox" id="${option.value}-toggle" class="toggle-checkbox share-toggle__checkbox" checked>
            <label for="${option.value}-toggle" class="toggle-checkbox__label share-toggle__label"></label>
            <span class="toggle-checkbox__text share-toggle__text">${option.label}</span>
        `;
        container.appendChild(toggleContainer);
    },

    shareCurrentPair() {
        const shareUrl = url.buildShareUrl();
        this.updateShareDialog(shareUrl);
    },

    generateShareLink() {
        let currentUrl = new URL(window.location.href);
        currentUrl.search = ''; // Clear existing parameters
        let currentTaxonImageCollection = state.getCurrentTaxonImageCollection();

        const shareOptions = document.querySelectorAll('#share-options-toggles input[type="checkbox"]');
        const selectedOptions = Array.from(shareOptions).filter(option => option.checked).map(option => option.id.replace('-toggle', ''));

        this.addSelectedOptionsToUrl(currentUrl, selectedOptions, currentTaxonImageCollection);

        return currentUrl.toString();
    },

    addSelectedOptionsToUrl(url, selectedOptions, currentTaxonImageCollection) {
        if (selectedOptions.includes('taxa') && currentTaxonImageCollection && currentTaxonImageCollection.pair) {
            const { taxonA, taxonB } = currentTaxonImageCollection.pair;
            url.searchParams.set('taxonA', taxonA);
            url.searchParams.set('taxonB', taxonB);
        }

        if (selectedOptions.includes('pairID') && currentTaxonImageCollection && currentTaxonImageCollection.pair) {
            const { pairID } = currentTaxonImageCollection.pair;
            if (pairID) url.searchParams.set('pairID', pairID);
        }

        if (selectedOptions.includes('tags')) {
            const activeTags = state.getSelectedTags();
            if (activeTags && activeTags.length > 0) {
                url.searchParams.set('tags', activeTags.join(','));
            }
        }

        if (selectedOptions.includes('level')) {
            const selectedLevel = state.getSelectedLevel();
            if (selectedLevel && selectedLevel !== '') {
                url.searchParams.set('level', selectedLevel);
            }
        }

        if (selectedOptions.includes('ranges')) {
            const selectedRanges = state.getSelectedRanges();
            if (selectedRanges && selectedRanges.length > 0) {
                url.searchParams.set('ranges', selectedRanges.join(','));
            }
        }

        if (selectedOptions.includes('phylogenyID')) {
            const phylogenyID = state.getPhylogenyId();
            if (phylogenyID) {
                url.searchParams.set('phylogenyID', phylogenyID);
            }
        }
    },
 
    qr: {
        generateAndShowQRCode(url) {
            loadQRCodeScript()
                .then(() => {
                    const qrCodeContainer = document.getElementById('qr-container');
                    qrCodeContainer.innerHTML = '';
                    new QRCode(qrCodeContainer, {
                        text: url,
                        width: 256,
                        height: 256
                    });
                })
                .catch(err => {
                    logger.error('Failed to load QR code script:', err);
                    alert('Failed to generate QR code. Please try again.');
                });
        },
    },
};

// Bind all methods to ensure correct 'this' context
Object.keys(sharing).forEach(key => {
    if (typeof sharing[key] === 'function') {
        sharing[key] = sharing[key].bind(sharing);
    }
});

// Bind methods in nested objects
Object.keys(sharing.qr).forEach(key => {
    if (typeof sharing.qr[key] === 'function') {
        sharing.qr[key] = sharing.qr[key].bind(sharing.qr);
    }
});

const publicAPI = {
    shareCurrentPair: sharing.shareCurrentPair
};

export default publicAPI;
