import dialogManager from './dialogManager.js';
import logger from './logger.js';
import state from './state.js';
import url from './url.js';

const sharing = {
    updateShareDialog(shareUrl) {
        const shareLinkInput = document.getElementById('share-link-input');
        shareLinkInput.value = shareUrl;

        sharing.qr.generateAndShowQRCode(shareUrl);
        sharing.createShareOptionToggles(shareUrl);

        const copyLinkButton = document.getElementById('copy-link-button');
        copyLinkButton.onclick = () => {
            const currentShareUrl = shareLinkInput.value;
            sharing.copyToClipboard(currentShareUrl)
                .then(() => {
                    const shareMessage = document.getElementById('qr-dialog__share-message');
                    if (shareMessage) {
                        shareMessage.textContent = 'Link copied to clipboard!';
                        shareMessage.style.opacity = 1;
                        setTimeout(() => {
                            shareMessage.style.opacity = 0;
                        }, 3000);
                    }
                })
                .catch(sharing.handleShareError);
        };

        // Add event listeners to checkboxes
        const shareOptions = document.querySelectorAll('#share-options-toggles input[type="checkbox"]');
        shareOptions.forEach(option => {
            option.addEventListener('change', () => {
                const newShareUrl = sharing.generateShareLink();
                shareLinkInput.value = newShareUrl;
                sharing.qr.generateAndShowQRCode(newShareUrl);
            });
        });

        dialogManager.openDialog('qr-dialog');
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
            { value: 'taxa', label: 'Taxa', isPresent: params.has('taxon1') || params.has('taxon2') },
            { value: 'setID', label: 'Set ID', isPresent: params.has('setID') },
            { value: 'tags', label: 'Tags', isPresent: params.has('tags') },
            { value: 'level', label: 'Level', isPresent: params.has('level') },
            { value: 'ranges', label: 'Ranges', isPresent: params.has('ranges') },
            { value: 'phylogenyID', label: 'Phylogeny', isPresent: params.has('phylogenyID') }
        ];

        options.forEach(option => {
            if (option.isPresent) {
                const toggleContainer = document.createElement('div');
                toggleContainer.className = 'share-toggle-container';
                toggleContainer.innerHTML = `
                    <input type="checkbox" id="${option.value}-toggle" class="share-toggle__checkbox" checked>
                    <label for="${option.value}-toggle" class="share-toggle__label"></label>
                    <span class="share-toggle__text">${option.label}</span>
                `;
                shareOptionsToggles.appendChild(toggleContainer);
            }
        });

        // Add event listeners to checkboxes
        const shareOptions = document.querySelectorAll('#share-options-toggles input[type="checkbox"]');
        shareOptions.forEach(option => {
            option.addEventListener('change', () => {
                const newShareUrl = sharing.generateShareLink();
                const shareLinkInput = document.getElementById('share-link-input');
                shareLinkInput.value = newShareUrl;
                sharing.qr.generateAndShowQRCode(newShareUrl);
            });
        });
    },

    shareCurrentPair() {
        const shareUrl = url.buildShareUrl();
        sharing.updateShareDialog(shareUrl);
    },

    generateShareLink() {
        let currentUrl = new URL(window.location.href);
        currentUrl.search = ''; // Clear existing parameters
        let currentTaxonImageCollection = state.getCurrentTaxonImageCollection();

        const shareOptions = document.querySelectorAll('#share-options-toggles input[type="checkbox"]');
        const selectedOptions = Array.from(shareOptions).filter(option => option.checked).map(option => option.id.replace('-toggle', ''));

        if (selectedOptions.includes('taxa') && currentTaxonImageCollection && currentTaxonImageCollection.pair) {
            const { taxon1, taxon2 } = currentTaxonImageCollection.pair;
            currentUrl.searchParams.set('taxon1', taxon1);
            currentUrl.searchParams.set('taxon2', taxon2);
        }

        if (selectedOptions.includes('setID') && currentTaxonImageCollection && currentTaxonImageCollection.pair) {
            const { setID } = currentTaxonImageCollection.pair;
            if (setID) currentUrl.searchParams.set('setID', setID);
        }

        if (selectedOptions.includes('tags')) {
            const activeTags = state.getSelectedTags();
            if (activeTags && activeTags.length > 0) {
                currentUrl.searchParams.set('tags', activeTags.join(','));
            }
        }

        if (selectedOptions.includes('level')) {
            const selectedLevel = state.getSelectedLevel();
            if (selectedLevel && selectedLevel !== '') {
                currentUrl.searchParams.set('level', selectedLevel);
            }
        }

        if (selectedOptions.includes('ranges')) {
            const selectedRanges = state.getSelectedRanges();
            if (selectedRanges && selectedRanges.length > 0) {
                currentUrl.searchParams.set('ranges', selectedRanges.join(','));
            }
        }

        if (selectedOptions.includes('phylogenyID')) {
            const phylogenyID = state.getPhylogenyId();
            if (phylogenyID) {
                currentUrl.searchParams.set('phylogenyID', phylogenyID);
            }
        }

        return currentUrl.toString();
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
                    dialogManager.openDialog('qr-dialog');
                })
                .catch(err => {
                    logger.error('Failed to load QR code script:', err);
                    alert('Failed to generate QR code. Please try again.');
                });
        },
    },
};

const publicAPI = {
    shareCurrentPair: sharing.shareCurrentPair
};

export default publicAPI;
