import config from './config.js';
import logger from './logger.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';

import roundManager from './roundManager.js';

const gameLogic = {
    answerHandling: {
        checkAnswer(droppedZoneId) {
            if (!this.isGameStateValid()) return;

            state.setState(state.GameState.CHECKING);
            const answers = this.getAnswersFromDropZones();

            if (this.areAnswersComplete(answers)) {
                this.evaluateAnswer(answers);
            } else {
                this.handleIncompleteAnswer();
            }
        },

        isGameStateValid() {
            const currentState = state.getState();
            if (currentState !== state.GameState.PLAYING) {
                logger.debug(`Cannot check answer when not in PLAYING state. Current state: ${currentState}`);
                return false;
            }
            return true;
        },

        getAnswersFromDropZones() {
            const drop1 = document.getElementById('drop-1');
            const drop2 = document.getElementById('drop-2');
            return {
                answerX: drop1.children[0]?.getAttribute('data-taxon'),
                answerY: drop2.children[0]?.getAttribute('data-taxon')
            };
        },

        areAnswersComplete(answers) {
            return answers.answerX && answers.answerY;
        },

        evaluateAnswer(answers) {
            const taxonImage1 = state.getTaxonImage1();
            const taxonImage2 = state.getTaxonImage2();
            
            const isCorrect =
                answers.answerX === taxonImage1 &&
                answers.answerY === taxonImage2;

            if (isCorrect) {
                this.handleCorrectAnswer();
            } else {
                this.handleIncorrectAnswer();
            }
        },

        handleIncompleteAnswer() {
            state.setState(state.GameState.PLAYING);
        },

        async handleCorrectAnswer() {
            await ui.showOverlay('Correct!', config.overlayColors.green);
            await utils.ui.sleep(1700);
            ui.resetDraggables();
            await roundManager.loadNewRound();
            await utils.ui.sleep(400); // wait for setupNameTiles()
        },

        async handleIncorrectAnswer() {
            ui.resetDraggables();
            await ui.showOverlay('Try again!', config.overlayColors.red);
            await utils.ui.sleep(1200);
            ui.hideOverlay();
            state.setState(state.GameState.PLAYING);
        },
    },
};

// Bind all methods in gameLogic and its nested objects
Object.keys(gameLogic).forEach(key => {
    if (typeof gameLogic[key] === 'object') {
        Object.keys(gameLogic[key]).forEach(nestedKey => {
            if (typeof gameLogic[key][nestedKey] === 'function') {
                gameLogic[key][nestedKey] = gameLogic[key][nestedKey].bind(gameLogic[key]);
            }
        });
    }
});

const publicAPI = {
    checkAnswer: gameLogic.answerHandling.checkAnswer,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(gameLogic);
    }
});

export default publicAPI;
