import api from './api.js';
import d3Graphs from './d3Graphs.js';
import dialogManager from './dialogManager.js';
import logger from './logger.js';
import state from './state.js';

const phylogenySelector = {
    initialize() {
        phylogenySelector.createDialog();
        phylogenySelector.setupEventListeners();
    },

    createDialog() {
        const dialog = document.createElement('dialog');
        dialog.id = 'phylogeny-selector-dialog';
        dialog.className = 'standard-dialog phylogeny-selector-dialog';

        dialog.innerHTML = `
            <button class="dialog-close-button icon" aria-label="Close">×</button>
            <h3 class="dialog-title">Phylogeny Selector</h3>
            <div id="phylogeny-graph-container" class="phylogeny-selector-dialog__graph-container"></div>
            <button id="phylogeny-done-button" class="button">Done</button>
        `;

        document.body.appendChild(dialog);
    },

    setupEventListeners() {
        const closeButton = document.querySelector('#phylogeny-selector-dialog .dialog-close-button');
        closeButton.addEventListener('click', () => dialogManager.closeDialog('phylogeny-selector-dialog'));

        const doneButton = document.getElementById('phylogeny-done-button');
        doneButton.addEventListener('click', () => phylogenySelector.handleDoneButton());
    },

    openDialog() {
        dialogManager.openDialog('phylogeny-selector-dialog');
        phylogenySelector.updateGraph();
    },

    async updateGraph() {
        const graphContainer = document.getElementById('phylogeny-graph-container');
        graphContainer.innerHTML = '<div class="loading-indicator">Loading phylogeny...</div>';

        const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();

        if (!hierarchyObj || !hierarchyObj.nodes) {
            graphContainer.innerHTML = '<p>Error: Taxonomy hierarchy not loaded or invalid</p>';
            return;
        }

        const rootNode = phylogenySelector.convertHierarchyToNestedObject(hierarchyObj);

        try {
            graphContainer.innerHTML = ''; // Clear the loading indicator
            await d3Graphs.createRadialTree(graphContainer, rootNode);
        } catch (error) {
            logger.error('Error creating phylogeny graph:', error);
            graphContainer.innerHTML = `<p>Error creating graph: ${error.message}. Please try again.</p>`;
        }
    },

    convertHierarchyToNestedObject(hierarchyObj) {
        const nodes = hierarchyObj.nodes;
        const nodeMap = new Map();
        let root = null;

        // First pass: create all nodes
        for (const [id, node] of nodes) {
            const newNode = {
                id: id,
                taxonName: node.taxonName,
                vernacularName: node.vernacularName,
                rank: node.rank,
                children: []
            };
            nodeMap.set(id, newNode);
            if (node.parentId === null) {
                root = newNode;
            }
        }

        // Second pass: build the tree structure
        for (const [id, node] of nodes) {
            if (node.parentId !== null) {
                const parent = nodeMap.get(node.parentId);
                if (parent) {
                    parent.children.push(nodeMap.get(id));
                } else {
                    logger.warn(`Parent node not found for ${node.taxonName} (ID: ${id})`);
                }
            }
        }

        if (!root) {
            logger.warn('No root node found, using first node as root');
            root = nodeMap.values().next().value;
        }

        return root;
    },

    handleDoneButton() {
        const activeNodeId = d3Graphs.getActiveNodeId();
        if (activeNodeId) {
            state.setPhylogenyId(activeNodeId);
            logger.debug(`Phylogeny ID set to: ${activeNodeId}`);
        } else {
            logger.warn('No active node selected');
        }
        dialogManager.closeDialog('phylogeny-selector-dialog');
    }
};

const publicAPI = {
    initialize: phylogenySelector.initialize,
    openDialog: phylogenySelector.openDialog
};

export default publicAPI;
