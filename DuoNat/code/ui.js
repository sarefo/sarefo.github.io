// UI functions

import api from './api.js';
import config from './config.js';
import {elements, gameState} from './state.js';
import game from './game.js';
import logger from './logger.js';

const ui = {

    // Enter pair dialog 
    clearDialogInputs: function () {
            document.getElementById('taxon1').value = '';
            document.getElementById('taxon2').value = '';
            document.getElementById('dialog-message').textContent = '';
        },

    resetGameContainerStyle: function () {
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            gameContainer.style.transform = '';
            gameContainer.style.opacity = '';
        }
        elements.imageOneContainer.style.transform = '';
        elements.imageOneContainer.style.opacity = '';
        elements.imageTwoContainer.style.transform = '';
        elements.imageTwoContainer.style.opacity = '';
    },

    // display pair list for selection
    showTaxonPairList: function () {
        api.fetchTaxonPairs().then(taxonPairs => {
            if (taxonPairs.length === 0) {
                logger.error("No taxon pairs available");
                return;
            }
            const modal = document.createElement('div');
            modal.className = 'taxon-pair-modal';
            
            const list = document.createElement('div');
            list.className = 'taxon-pair-list';
            
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.className = 'taxon-pair-cancel-button';
            cancelButton.onclick = closeModal;
            
            taxonPairs.forEach((pair, index) => {
                const button = document.createElement('button');
                button.innerHTML = `<i>${pair.taxon1}</i> <span class="taxon-pair-versus">vs</span> <i>${pair.taxon2}</i>`;
                button.className = 'taxon-pair-button';
                button.onclick = () => {
                    // Set the selected pair as the next pair to be used
                    game.nextSelectedPair = pair;
                    
                    // Close the modal
                    closeModal();
                    
                    // Set up the game with the new pair
                    game.setupGame(true);
                };
                list.appendChild(button);
            });
            
            list.insertBefore(cancelButton, list.firstChild);
            
            modal.appendChild(list);
            document.body.appendChild(modal);
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            };

            // Add event listener for the Escape key
            const handleEscapeKey = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                }
            };

            document.addEventListener('keydown', handleEscapeKey);

            // Function to close the modal
            function closeModal() {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEscapeKey);
            }
        });
    },

    showOverlay: function (message="", color) {
        elements.overlayMessage.innerHTML = message;
        elements.overlay.style.backgroundColor = color;
        elements.overlay.classList.add('show');
        
        // Adjust font size for longer messages
        if (message.length > 20) {
            elements.overlayMessage.style.fontSize = '1.2em';
        } else {
            elements.overlayMessage.style.fontSize = '2.4em';
        }
    },

    updateOverlayMessage: function (message) {
        elements.overlayMessage.innerHTML = message;
    },

    hideOverlay: function () {
        elements.overlay.classList.remove('show');
    },

    scrollToTop: () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

showINatDownDialog: function () {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    const dialog = document.getElementById('inat-down-dialog');
    dialog.showModal();
    
    const checkStatusBtn = document.getElementById('check-inat-status');
    const retryConnectionBtn = document.getElementById('retry-connection');
    
    const checkStatusHandler = () => {
        window.open('https://inaturalist.org', '_blank');
    };
    
    const retryConnectionHandler = async () => {
        dialog.close();
        if (await api.isINaturalistReachable()) {
            game.setupGame(true);
        } else {
            this.showINatDownDialog();
        }
    };
    
    checkStatusBtn.addEventListener('click', checkStatusHandler);
    retryConnectionBtn.addEventListener('click', retryConnectionHandler);
    
    dialog.addEventListener('close', () => {
        checkStatusBtn.removeEventListener('click', checkStatusHandler);
        retryConnectionBtn.removeEventListener('click', retryConnectionHandler);
    });
},
    hideINatDownDialog: function () {
        const dialog = document.getElementById('inat-down-dialog');
        dialog.close();
    },

    showTutorial: function() {
        const steps = [
            { message: "Welcome to DuoNat!<br>Let's learn how to play.", highlight: null },
            { message: "You'll see two images of different taxa.", highlights: ['#image-container-1', '#image-container-2'] },
            { message: "Drag the name tags here in the center<br>to match them with the correct images.", highlight: '.name-pair' },
            { message: "If you're correct,<br>you'll move to the next round.", highlight: null, showNextImages: true },
            { message: "Swipe left on an image<br>for a new set of species.", highlight: '.game-container' },
            { message: "Share your favorite pairs<br>with the share button on top.", highlight: '#share-button' },
            { message: "Scroll down for more functions.", highlight: '.scrollable-content', scroll: true },
            { message: "Ready to start? Let's go!", highlight: null }
        ];

        let currentStep = 0;
        let highlightElements = [];

        const showStep = () => {
            if (currentStep < steps.length) {
                const step = steps[currentStep];
                this.showOverlay(step.message, config.overlayColors.green);
                
                highlightElements.forEach(el => el.remove());
                highlightElements = [];

                if (step.highlight) {
                    const highlight = this.createHighlight(step.highlight);
                    if (highlight) highlightElements.push(highlight);
                } else if (step.highlights) {
                    step.highlights.forEach(selector => {
                        const highlight = this.createHighlight(selector);
                        if (highlight) highlightElements.push(highlight);
                    });
                }

                if (step.scroll) {
                    this.scrollToBottom(() => {
                        setTimeout(() => {
                            this.scrollToTop();
                        }, 1500);
                    });
                }

                if (step.showNextImages) {
                    this.showNextRoundImages();
                } else if (this.originalImages) {
                    this.restoreOriginalImages();
                }

                currentStep++;
                setTimeout(() => {
                    this.hideOverlay();
                    setTimeout(showStep, 500); // Short pause between steps
                }, 4000); // Show each step for 4 seconds
            } else {
                this.hideOverlay();
                highlightElements.forEach(el => el.remove());
                if (this.originalImages) {
                    this.restoreOriginalImages();
                }
                //game.setupGame(true); // Start a new game after the tutorial
            }
        };

        // Close the help dialog before starting the tutorial
        document.getElementById('help-dialog').close();
        showStep();
    },

    scrollToBottom: function(callback) {
        const scrollableContent = document.querySelector('.scrollable-content');
        if (scrollableContent) {
            const scrollOptions = {
                top: scrollableContent.scrollHeight - scrollableContent.clientHeight,
                behavior: 'smooth'
            };
            scrollableContent.scrollTo(scrollOptions);
            setTimeout(callback, 1000); // Wait for scroll to complete
        } else {
            console.warn('Scrollable content not found');
            callback();
        }
    },

    scrollToTop: function() {
        const scrollableContent = document.querySelector('.scrollable-content');
        if (scrollableContent) {
            scrollableContent.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else {
            console.warn('Scrollable content not found');
        }
    },

    showNextRoundImages: function() {
        const imageOne = document.getElementById('image-1');
        const imageTwo = document.getElementById('image-2');
        
        // Store original images if not already stored
        if (!this.originalImages) {
            this.originalImages = {
                one: imageOne.src,
                two: imageTwo.src
            };
        }

        // Show preloaded images for next round
        if (game.preloadedImages && game.preloadedImages.taxon1 && game.preloadedImages.taxon1.length > 0 &&
            game.preloadedImages.taxon2 && game.preloadedImages.taxon2.length > 0) {
            imageOne.src = game.preloadedImages.taxon1[0];
            imageTwo.src = game.preloadedImages.taxon2[0];
        } else {
            console.warn('Preloaded images for the next round are not available.');
        }
    },

    restoreOriginalImages: function() {
        if (this.originalImages) {
            const imageOne = document.getElementById('image-1');
            const imageTwo = document.getElementById('image-2');
            imageOne.src = this.originalImages.one;
            imageTwo.src = this.originalImages.two;
            this.originalImages = null;
        }
    },

restoreOriginalImages: function() {
    if (this.originalImages) {
        const imageOne = document.getElementById('image-1');
        const imageTwo = document.getElementById('image-2');
        imageOne.src = this.originalImages.one;
        imageTwo.src = this.originalImages.two;
        this.originalImages = null;
    }
},

    createHighlight: function(targetSelector) {
        const target = document.querySelector(targetSelector);
        if (!target) {
            console.error(`Target element not found: ${targetSelector}`);
            return null;
        }

        const highlight = document.createElement('div');
        highlight.className = 'tutorial-highlight';
        document.body.appendChild(highlight);

        const targetRect = target.getBoundingClientRect();
        highlight.style.width = `${targetRect.width}px`;
        highlight.style.height = `${targetRect.height}px`;
        highlight.style.top = `${targetRect.top}px`;
        highlight.style.left = `${targetRect.left}px`;

        console.log(`Highlight created for: ${targetSelector}`);

        return highlight;
    },

}; // const ui

export default ui;
