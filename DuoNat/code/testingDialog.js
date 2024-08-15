import api from './api.js';
import d3Graphs from './d3Graphs.js';
import dialogManager from './dialogManager.js';
import { gameState } from './state.js';
import logger from './logger.js';

const testingDialog = {
    initialize() {
        testingDialog.createDialog();
        testingDialog.setupEventListeners();
    },

    createDialog() {
        const dialog = document.createElement('dialog');
        dialog.id = 'testing-dialog';
        dialog.className = 'standard-dialog testing-dialog';

        dialog.innerHTML = `
            <button class="dialog-close-button icon" aria-label="Close">×</button>
            <h3 class="dialog-title">Graph Testing</h3>
            <select id="graph-type-select">
                <option value="radial">Interactive Radial Tree</option>
                <option value="hierarchical">Hierarchical Tree View</option>
            </select>
            <div id="graph-container" class="testing-dialog__graph-container"></div>
        `;

        document.body.appendChild(dialog);
    },

    setupEventListeners() {
        const closeButton = document.querySelector('#testing-dialog .dialog-close-button');
        closeButton.addEventListener('click', () => dialogManager.closeDialog('testing-dialog'));

        const graphTypeSelect = document.getElementById('graph-type-select');
        graphTypeSelect.addEventListener('change', () => testingDialog.updateGraph());
    },

    openDialog() {
        dialogManager.openDialog('testing-dialog');
        testingDialog.updateGraph();
    },

    async updateGraph() {
        const graphType = document.getElementById('graph-type-select').value;
        const graphContainer = document.getElementById('graph-container');
        graphContainer.innerHTML = '<div class="loading-indicator">Loading graph...</div>';

        const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();

        if (!hierarchyObj || !hierarchyObj.nodes) {
            graphContainer.innerHTML = '<p>Error: Taxonomy hierarchy not loaded or invalid</p>';
            return;
        }

        const rootNode = testingDialog.convertHierarchyToNestedObject(hierarchyObj);

        try {
            graphContainer.innerHTML = ''; // Clear the loading indicator
            switch (graphType) {
                case 'radial':
                    await d3Graphs.createRadialTree(graphContainer, rootNode);
                    break;
                case 'hierarchical':
                    await d3Graphs.createHierarchicalTree(graphContainer, rootNode);
                    break;
                default:
                    throw new Error('Invalid graph type');
            }
        } catch (error) {
            logger.error('Error creating graph:', error);
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
};

const publicAPI = {
    initialize: testingDialog.initialize,
    openDialog: testingDialog.openDialog
};

export default publicAPI;
//export default testingDialog;
