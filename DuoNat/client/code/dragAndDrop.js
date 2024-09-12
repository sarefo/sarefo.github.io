import logger from './logger.js';
import state from './state.js';

import gameLogic from './gameLogic.js';

const dragAndDrop = {
    // Modules:
    // - state
    // - init
    // - eventListeners
    // - dragHandlers
    // - dropHandlers
    // - utils

    state: {
        draggedElement: null,
        touchOffset: { x: 0, y: 0 },
        gameContainer: null,
        initialY: 0,
        otherElementInitialY: 0,
    },

    init: {
        initialize() {
            dragAndDrop.state.gameContainer = document.querySelector('.game-container');
            dragAndDrop.eventListeners.addEventListeners();
        },
    },

    eventListeners: {
        addEventListeners() {
            document.querySelectorAll('.name-pair__item--draggable').forEach(element => {
                element.addEventListener('dragstart', dragAndDrop.dragHandlers.dragStart.bind(this));
                element.addEventListener('mousedown', dragAndDrop.dragHandlers.mouseStart.bind(this));
                element.addEventListener('touchstart', dragAndDrop.dragHandlers.touchStart.bind(this), { passive: false });
                element.addEventListener('touchmove', dragAndDrop.dragHandlers.touchMove.bind(this), { passive: false });
                element.addEventListener('touchend', dragAndDrop.dragHandlers.touchEnd.bind(this), { passive: false });
            });

            document.addEventListener('mousemove', dragAndDrop.dragHandlers.mouseMove.bind(this));
            document.addEventListener('mouseup', dragAndDrop.dragHandlers.mouseEnd.bind(this));

            document.querySelectorAll('.image-container').forEach(element => {
                element.addEventListener('dragover', dragAndDrop.dropHandlers.dragOver.bind(this));
                element.addEventListener('dragleave', dragAndDrop.dropHandlers.dragLeave.bind(this));
                element.addEventListener('drop', dragAndDrop.dropHandlers.drop.bind(this));
            });
        },
    },

    dragHandlers: {
        mouseStart(e) {
            e.preventDefault();
            dragAndDrop.state.draggedElement = e.target.closest('.name-pair__item--draggable');
            if (!dragAndDrop.state.draggedElement) return;

            const rect = dragAndDrop.state.draggedElement.getBoundingClientRect();
            dragAndDrop.state.touchOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            dragAndDrop.state.initialX = e.clientX;
            dragAndDrop.state.initialY = e.clientY;
            dragAndDrop.utils.captureOtherElementPosition();

            dragAndDrop.state.draggedElement.classList.add('name-pair__item--dragging');
            dragAndDrop.state.draggedElement.style.zIndex = '1000';

            dragAndDrop.utils.updateElementPosition(e);
        },

        touchStart(e) {
            e.preventDefault();
            dragAndDrop.state.draggedElement = e.target.closest('.name-pair__item--draggable');
            if (!dragAndDrop.state.draggedElement) return;

            const touch = e.touches[0];
            const rect = dragAndDrop.state.draggedElement.getBoundingClientRect();
            dragAndDrop.state.touchOffset = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            dragAndDrop.state.initialX = touch.clientX;
            dragAndDrop.state.initialY = touch.clientY;
            dragAndDrop.utils.captureOtherElementPosition();

            dragAndDrop.state.draggedElement.classList.add('name-pair__item--dragging');
            dragAndDrop.state.draggedElement.style.zIndex = '1000';

            dragAndDrop.utils.updateElementPosition(touch);
        },

        mouseMove(e) {
            if (dragAndDrop.state.draggedElement) {
                e.preventDefault();
                dragAndDrop.utils.updateElementPosition(e);
            }
        },

        dragStart(e) {
            e.dataTransfer.setData('text/plain', e.target.id);
        },

        touchMove(e) {
            e.preventDefault();
            if (dragAndDrop.state.draggedElement) {
                const touch = e.touches[0];
                dragAndDrop.utils.updateElementPosition(touch);
            } else {
                logger.debug('No dragged element during touchMove');
            }
        },


        mouseEnd(e) {
            if (dragAndDrop.state.draggedElement) {
                const dropZone = dragAndDrop.utils.getDropZone(e);
                if (dropZone) {
                    dragAndDrop.dropHandlers.handleDrop(dropZone);
                } else {
                    dragAndDrop.utils.resetDraggedElement();
                }
                dragAndDrop.state.draggedElement = null;
            }
        },

        touchEnd(e) {
            e.preventDefault();
            if (dragAndDrop.state.draggedElement) {
                const dropZone = dragAndDrop.utils.getDropZone(e);
                if (dropZone) {
                    dragAndDrop.dropHandlers.handleDrop(dropZone);
                } else {
                    dragAndDrop.utils.resetDraggedElement();
                }
                dragAndDrop.state.draggedElement = null;
            }
        },
    },

    dropHandlers: {
        dragOver(e) {
            e.preventDefault();
            if (e.target.classList.contains('image-container')) {
                e.target.classList.add('image-container--drag-over');
            }
        },

        dragLeave(e) {
            if (e.target.classList.contains('image-container')) {
                e.target.classList.remove('image-container--drag-over');
            }
        },

        drop(e) {
            e.preventDefault();
            const data = e.dataTransfer.getData('text');
            const draggedElement = document.getElementById(data);

            let dropZone;
            if (e.target.classList.contains('image-container')) {
                e.target.classList.remove('image-container--drag-over');
                dropZone = e.target.querySelector('div[id^="drop-"]');
            } else if (e.target.tagName === 'IMG') {
                e.target.parentElement.classList.remove('image-container--drag-over');
                dropZone = e.target.nextElementSibling;
            } else {
                return; // Drop on an invalid target
            }

            this.handleDrop(dropZone, draggedElement);
        },

        handleDrop(dropZone, draggedElement = dragAndDrop.state.draggedElement) {
            if (!draggedElement) return;

            const isCorrect = dragAndDrop.utils.isAnswerCorrect(dropZone.id, draggedElement.id);
            const otherElement = draggedElement.id === 'name-x' ?
                document.getElementById('name-y') :
                document.getElementById('name-x');

            dragAndDrop.utils.animateElement(draggedElement, dropZone, isCorrect);
            dragAndDrop.utils.animateElement(otherElement, dragAndDrop.utils.getOtherDropZone(dropZone), isCorrect);

            setTimeout(() => {
                dragAndDrop.utils.finalizeDropAnimation(draggedElement, otherElement, dropZone, isCorrect);
                // Ensure the game is in PLAYING state before checking the answer
                state.setState(state.GameState.PLAYING);
                gameLogic.checkAnswer(dropZone.id);
            }, 300);
        },
    },

    utils: {

        captureOtherElementPosition() {
            const otherElement = dragAndDrop.state.draggedElement.id === 'name-x' ?
                document.getElementById('name-y') :
                document.getElementById('name-x');
            if (otherElement) {
                const rect = otherElement.getBoundingClientRect();
                dragAndDrop.state.otherElementInitialX = rect.left;
                dragAndDrop.state.otherElementInitialY = rect.top;
            }
        },

        isAnswerCorrect(dropZoneId, draggedElementId) {
            try {
                const isLeftDrop = dropZoneId === 'drop-1';
                const draggedElement = document.getElementById(draggedElementId);

                if (!draggedElement) {
                    logger.error('Dragged element not found');
                    return false;
                }

                const draggedTaxon = draggedElement.getAttribute('data-taxon');

                let gameState = state.getGameState();
                if (!gameState) {
                    logger.error('gameState is undefined');
                    return false;
                }

                const correctTaxon = isLeftDrop ? gameState.taxonImage1 : gameState.taxonImage2;

                if (!correctTaxon) {
                    logger.error('Correct taxon is undefined in gameState');
                    return false;
                }

                return draggedTaxon === correctTaxon;
            } catch (error) {
                logger.error('Error in isAnswerCorrect:', error);
                return false;
            }
        },

        getDropZone(e) {
            const touch = e.changedTouches ? e.changedTouches[0] : e;
            const imageContainers = document.querySelectorAll('.image-container');
            for (let container of imageContainers) {
                const rect = container.getBoundingClientRect();
                if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    return container.querySelector('div[id^="drop-"]');
                }
            }
            return null;
        },

        getOtherDropZone(dropZone) {
            return document.getElementById(dropZone.id === 'drop-1' ? 'drop-2' : 'drop-1');
        },

        resetDraggedElement() {
            if (!dragAndDrop.state.draggedElement) return;

            const elements = [
                dragAndDrop.state.draggedElement,
                dragAndDrop.state.draggedElement.id === 'name-x' ? document.getElementById('name-y') : document.getElementById('name-x')
            ];

            elements.forEach(element => {
                const originalContainer = element.id === 'name-x' ? 'name-pair__container--x' : 'name-pair__container--y';
                const container = document.getElementsByClassName(originalContainer)[0];

                element.classList.remove('name-pair__item--dragging', 'name-pair__item--landing');
                element.style = '';
                container.appendChild(element);
            });

            dragAndDrop.state.draggedElement = null;
        },

        getOrientation() {
            return document.body.classList.contains('landscape-layout') ? 'landscape' : 'portrait';
        },

        updateElementPosition(event) {
            if (!dragAndDrop.state.draggedElement || !dragAndDrop.state.gameContainer) {
                return;
            }

            const gameContainerRect = dragAndDrop.state.gameContainer.getBoundingClientRect();
            const elementWidth = dragAndDrop.state.draggedElement.offsetWidth;
            const elementHeight = dragAndDrop.state.draggedElement.offsetHeight;
            const clientX = event.touches ? event.touches[0].clientX : event.clientX;
            const clientY = event.touches ? event.touches[0].clientY : event.clientY;

            const orientation = this.getOrientation();

            let leftPosition, topPosition;

            if (orientation === 'landscape') {
                const deltaX = clientX - dragAndDrop.state.initialX;
                topPosition = gameContainerRect.top + (elementHeight / 2);
                leftPosition = clientX - dragAndDrop.state.touchOffset.x - (gameContainerRect.width / 2) + (elementWidth / 2);
                this.mirrorOtherElementHorizontal(deltaX, gameContainerRect, elementHeight, elementWidth);
            } else {
                const deltaY = clientY - dragAndDrop.state.initialY;
                leftPosition = gameContainerRect.left + (gameContainerRect.width / 2) - (elementWidth / 2);
                topPosition = clientY - dragAndDrop.state.touchOffset.y;
                this.mirrorOtherElementVertical(deltaY, gameContainerRect, elementWidth);
            }

            requestAnimationFrame(() => {
                if (dragAndDrop.state.draggedElement) {
                    dragAndDrop.state.draggedElement.style.position = 'fixed';
                    dragAndDrop.state.draggedElement.style.left = `${leftPosition}px`;
                    dragAndDrop.state.draggedElement.style.top = `${topPosition}px`;
                }
            });
        },

        mirrorOtherElementHorizontal(deltaX, gameContainerRect, elementHeight, elementWidth) {
            const otherElement = dragAndDrop.state.draggedElement.id === 'name-x' ?
                document.getElementById('name-y') :
                document.getElementById('name-x');

            if (otherElement) {
                const topPosition = gameContainerRect.top + (elementHeight / 2);
                const leftPosition = dragAndDrop.state.otherElementInitialX - deltaX - (gameContainerRect.width / 2)+ (elementWidth / 2);

                otherElement.style.position = 'fixed';
                otherElement.style.left = `${leftPosition}px`;
                otherElement.style.top = `${topPosition}px`;
            }
        },

        mirrorOtherElementVertical(deltaY, gameContainerRect, elementWidth) {
            const otherElement = dragAndDrop.state.draggedElement.id === 'name-x' ?
                document.getElementById('name-y') :
                document.getElementById('name-x');

            if (otherElement) {
                const leftPosition = gameContainerRect.left + (gameContainerRect.width / 2) - (elementWidth / 2);
                const topPosition = dragAndDrop.state.otherElementInitialY - deltaY;

                otherElement.style.position = 'fixed';
                otherElement.style.left = `${leftPosition}px`;
                otherElement.style.top = `${topPosition}px`;
            }
        },

        animateElement(element, targetZone, isCorrect) {
            const currentRect = element.getBoundingClientRect();
            let targetRect;

            if (isCorrect) {
                targetRect = targetZone.getBoundingClientRect();
            } else {
                const originalContainer = element.id === 'name-x' ?
                    document.querySelector('.name-pair__container--x') :
                    document.querySelector('.name-pair__container--y');
                targetRect = originalContainer.getBoundingClientRect();
            }

            element.style.position = 'fixed';
            element.style.left = `${currentRect.left}px`;
            element.style.top = `${currentRect.top}px`;
            element.style.width = `${currentRect.width}px`;
            element.style.height = `${currentRect.height}px`;
            element.style.zIndex = '1000';

            document.body.appendChild(element);
            element.offsetHeight; // Force reflow
            element.classList.add('name-pair__item--landing');

            element.style.left = `${targetRect.left}px`;
            element.style.top = `${targetRect.top}px`;
            element.style.width = `${targetRect.width}px`;
            element.style.height = `${targetRect.height}px`;
        },

        finalizeDropAnimation(draggedElement, otherElement, dropZone, isCorrect) {
            [draggedElement, otherElement].forEach(element => {
                element.classList.remove('name-pair__item--landing', 'name-pair__item--dragging');
                element.style.position = '';
                element.style.left = '';
                element.style.top = '';
                element.style.width = '';
                element.style.height = '';
                element.style.zIndex = '';
            });

            if (isCorrect) {
                dropZone.innerHTML = '';
                dropZone.appendChild(draggedElement);

                const otherDropZone = dragAndDrop.utils.getOtherDropZone(dropZone);
                otherDropZone.innerHTML = '';
                otherDropZone.appendChild(otherElement);
            } else {
                const leftContainer = document.querySelector('.name-pair__container--x');
                const rightContainer = document.querySelector('.name-pair__container--y');

                leftContainer.appendChild(document.getElementById('name-x'));
                rightContainer.appendChild(document.getElementById('name-y'));
            }

            draggedElement.classList.add(isCorrect ? 'name-pair__item--correct' : 'name-pair__item--incorrect');
            setTimeout(() => {
                draggedElement.classList.remove('name-pair__item--correct', 'name-pair__item--incorrect');
            }, 600);
        },

        moveTileToDropZone(tilePosition, dropZonePosition) {
            const draggedElement = document.getElementById(tilePosition === 'left' ? 'name-x' : 'name-y');
            const otherElement = document.getElementById(tilePosition === 'left' ? 'name-y' : 'name-x');
            const dropZone = document.getElementById(dropZonePosition === 'upper' ? 'drop-1' : 'drop-2');
            const otherDropZone = document.getElementById(dropZonePosition === 'upper' ? 'drop-2' : 'drop-1');

            if (draggedElement && dropZone) {
                const isCorrect = dragAndDrop.utils.isAnswerCorrect(dropZone.id, draggedElement.id);

                dragAndDrop.utils.animateElement(draggedElement, dropZone, isCorrect);
                dragAndDrop.utils.animateElement(otherElement, otherDropZone, isCorrect);

                setTimeout(() => {
                    dragAndDrop.utils.finalizeDropAnimation(draggedElement, otherElement, dropZone, isCorrect);
                    // Ensure the game is in PLAYING state before checking the answer
                    state.setState(state.GameState.PLAYING);
                    gameLogic.checkAnswer(dropZone.id);
                }, 300);
            }
        },
    },
};

// Bind all methods in dragAndDrop and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};
bindMethodsRecursively(dragAndDrop);

const publicAPI = {
    initialize: dragAndDrop.init.initialize,
    moveTileToDropZone: dragAndDrop.utils.moveTileToDropZone, // for keyboard shortcut
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(dragAndDrop);
    }
});

export default publicAPI;
