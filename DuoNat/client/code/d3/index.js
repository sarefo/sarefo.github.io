import { RadialTree } from './RadialTree.js';
import { HierarchicalTree } from './HierarchicalTree.js';
import { loadD3 } from './BaseTree.js';

let useHierarchicalLayout = false;

const d3Graphs = {
    createTree: async function (container, rootNode, showTaxonomicNames) {
        const TreeClass = useHierarchicalLayout ? HierarchicalTree : RadialTree;
        const tree = new TreeClass(container, rootNode, showTaxonomicNames);
        await tree.create();
        this.lastCreatedTree = tree;
        return tree;
    },

    setLayoutType: function (isHierarchical) {
        useHierarchicalLayout = isHierarchical;
    },

    setTreeType: function (treeType) {
        if (this.lastCreatedTree) {
            const container = this.lastCreatedTree.container;
            const rootNode = this.lastCreatedTree.rootNode;
            const showTaxonomicNames = this.lastCreatedTree.showTaxonomicNames;
            const activeNodeId = this.lastCreatedTree.getActiveNodeId();

            // Clear the existing tree
            d3.select(container).selectAll('*').remove();

            // Create the new tree
            this.createTree(container, rootNode, showTaxonomicNames, treeType).then(newTree => {
                newTree.setActiveNode(activeNodeId);
            });
        } else {
            logger.warn('No tree instance available to change type');
        }
    },

    createRadialTree: async function (container, rootNode, showTaxonomicNames) {
        const tree = new RadialTree(container, rootNode, showTaxonomicNames);
        await tree.create();
        this.lastCreatedTree = tree;
        return tree; // Return the tree instance
    },

    createHierarchicalTree: async function (container, rootNode, showTaxonomicNames) {
        const tree = new HierarchicalTree(container, rootNode, showTaxonomicNames);
        await tree.create();
        this.lastCreatedTree = tree;
        return tree;
    },

    getActiveNodeId: function () {
        // This assumes that the last created tree is the active one
        return this.lastCreatedTree ? this.lastCreatedTree.getActiveNodeId() : null;
    },
    setActiveNode: function (nodeId) {
        if (this.lastCreatedTree) {
            this.lastCreatedTree.setActiveNode(nodeId);
        } else {
            logger.warn('No tree instance available to set active node');
        }
    },

    updateNodeLabels: function (showTaxonomicNames) {
        if (this.lastCreatedTree) {
            this.lastCreatedTree.updateNodeLabels(showTaxonomicNames);
        } else {
            logger.warn('No tree instance available to update node labels');
        }
    },

    loadD3: loadD3
};

// Bind d3Graphs methods
Object.keys(d3Graphs).forEach(key => {
    if (typeof d3Graphs[key] === 'function') {
        d3Graphs[key] = d3Graphs[key].bind(d3Graphs);
    }
});

export default d3Graphs;
