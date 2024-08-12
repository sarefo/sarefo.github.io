import api from './api.js';
import { createHierarchicalTree, createRadialTree } from './d3Graphs.js';
import dialogManager from './dialogManager.js';
import { gameState } from './state.js';
import logger from './logger.js';

const testingDialog = {
    initialize() {
        this.createDialog();
        this.setupEventListeners();
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
        graphTypeSelect.addEventListener('change', () => this.updateGraph());
    },

    openDialog() {
        dialogManager.openDialog('testing-dialog');
        this.updateGraph();
    },

    async updateGraph() {
        const graphType = document.getElementById('graph-type-select').value;
        const graphContainer = document.getElementById('graph-container');
/*        graphContainer.innerHTML = '<div class="loading-indicator">Loading graph...</div>';*/

        const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();

        if (!hierarchyObj || !hierarchyObj.nodes) {
            graphContainer.innerHTML = '<p>Error: Taxonomy hierarchy not loaded or invalid</p>';
            return;
        }

        const rootNode = this.convertHierarchyToNestedObject(hierarchyObj);

        try {
            switch (graphType) {
                case 'radial':
                    await createRadialTree(graphContainer, rootNode);
                    break;
                case 'hierarchical':
                    await createHierarchicalTree(graphContainer, rootNode);
                    break;
            }
        } catch (error) {
            logger.error('Error creating graph:', error);
            graphContainer.innerHTML = '<p>Error creating graph. Please try again.</p>';
        }
    },

    convertHierarchyToNestedObject(hierarchyObj) {
        const nodes = hierarchyObj.nodes;
        const nodeMap = new Map();
        let root = null;

//        console.log('Total nodes:', nodes.size);

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
//                console.log('Root node found:', newNode);
            }
        }

//        console.log('Nodes created:', nodeMap.size);

        // Second pass: build the tree structure
        for (const [id, node] of nodes) {
            if (node.parentId !== null) {
                const parent = nodeMap.get(node.parentId);
                if (parent) {
                    parent.children.push(nodeMap.get(id));
//                    console.log(`Added ${node.taxonName} to ${parent.taxonName}`);
                } else {
//                    console.warn(`Parent node not found for ${node.taxonName} (ID: ${id})`);
                }
            }
        }

        if (!root) {
//            console.warn('No root node found, using first node as root');
            root = nodeMap.values().next().value;
        }

//        console.log('Root node children:', root.children.length);
//        console.log('First level children:', root.children.map(child => child.taxonName));

        return root;
    },

};

export default testingDialog;
