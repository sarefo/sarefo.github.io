import logger from '../logger.js';
import state from '../state.js';
import utils from '../utils.js';

let d3;

async function loadD3() {
    if (!d3) {
        d3 = await import('https://cdn.jsdelivr.net/npm/d3@7/+esm');
    }
    return d3;
}

export class BaseTree {
    constructor(container, rootNode, showTaxonomicNames) {
        this.container = container;
        this.rootNode = rootNode;
        this.showTaxonomicNames = showTaxonomicNames;
        this.svg = null;
        this.treeLayout = null;
        this.d3 = null;
        this.root = null;
        this.parentNode = null;
        this.activeNode = null;
        this.dragOffset = [0, 0];
        this.onNodeSelect = null;
    }

    async initialize() {
        this.d3 = await loadD3();
        this.root = this.d3.hierarchy(this.rootNode);
        if (!this.root) {
            logger.error('Failed to create hierarchy from root node');
            return false;
        }
        return true;
    }

    _setupSvg(width, height) {
        this.d3.select(this.container).selectAll("svg").remove();

        this.svg = this.d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .append('g')
            .attr('class', 'draggable-group');
    }

    _setupDrag() {
        const drag = this.d3.drag()
            .on('start', this._dragStarted.bind(this))
            .on('drag', this._dragged.bind(this))
            .on('end', this._dragEnded.bind(this));

        this.svg.call(drag);
    }

    _dragStarted(event) {
        this.d3.select(this.container).style('cursor', 'grabbing');
    }

    _dragged(event) {
        this.dragOffset[0] += event.dx;
        this.dragOffset[1] += event.dy;
        this.svg.attr('transform', `translate(${this.dragOffset[0]},${this.dragOffset[1]})`);
    }

    _dragEnded() {
        this.d3.select(this.container).style('cursor', 'grab');
    }

    _addStyles() {
        this.svg.append('style').text(`
            .link {
                fill: none;
                stroke: #ccc;
                stroke-width: 1.5px;
            }
            .node circle {
                fill: #fff;
                stroke: #74ac00;
                stroke-width: 1.5px;
            }
            .node text {
                font: 12px sans-serif;
            }
            .node--central circle {
                fill: #74ac00;
            }
            .node--active circle {
                stroke: #ac0028;
                stroke-width: 2px;
            }
        `);
    }

    calculateRadius(pairCount, maxCount) {
        const minRadius = 3;
        const maxRadius = 15;
        const minCount = 1;
        
        if (pairCount === 0) return minRadius;
        
        const scale = this.d3.scaleLog()
            .domain([minCount, maxCount])
            .range([minRadius, maxRadius]);
        
        return scale(pairCount);
    }

    updateNodeLabels(showTaxonomicNames) {
        this.showTaxonomicNames = showTaxonomicNames;
        this.svg.selectAll('g.node text')
            .text(d => !this.showTaxonomicNames && d.data.vernacularName && d.data.vernacularName !== "-" ? 
                utils.string.truncate(d.data.vernacularName, 24) : d.data.taxonName)
            .attr('title', d => !this.showTaxonomicNames && d.data.vernacularName && d.data.vernacularName !== "-" ? 
                d.data.taxonName : utils.string.truncate(d.data.vernacularName, 24));
    }

    setActiveNode(nodeId) {
        state.setCurrentActiveNodeId(nodeId);

        const node = this.root.descendants().find(d => d.data.id === nodeId);
        if (node) {
            this.parentNode = node.parent || this.root;
            this.activeNode = node;
            this.update(this.activeNode);
        } else {
            logger.warn(`Node with id ${nodeId} not found in the tree`);
        }
    }

    getActiveNodeId() {
        return this.activeNode ? this.activeNode.data.id : null;
    }

    setActiveNodePath(pathToRoot) {
        let currentNode = this.root;
        for (let i = 1; i < pathToRoot.length; i++) {
            const targetId = pathToRoot[i];
            if (currentNode._children) {
                currentNode.children = currentNode._children;
            }
            if (currentNode.children) {
                currentNode = currentNode.children.find(child => child.data.id === targetId);
                if (!currentNode) {
                    logger.warn(`Node with id ${targetId} not found in the tree`);
                    break;
                }
            } else {
                logger.warn(`Node with id ${currentNode.data.id} has no children`);
                break;
            }
        }

        if (currentNode && currentNode.data.id === pathToRoot[pathToRoot.length - 1]) {
            this.parentNode = currentNode.parent || this.root;
            this.activeNode = currentNode;

            if (this.activeNode._children) {
                this.activeNode.children = this.activeNode._children;
            }

            if (!this.activeNode.children && this.parentNode.children) {
                this.parentNode.children.forEach(sibling => {
                    if (sibling._children) {
                        sibling.children = sibling._children;
                    }
                });
            }

            this.update(this.activeNode);
        } else {
            logger.warn(`Failed to reach target node ${pathToRoot[pathToRoot.length - 1]}`);
        }
    }

    _setupResizeObserver() {
        const resizeObserver = new ResizeObserver(() => {
            const { width, height } = this._getDimensions();
            this.svg.attr('viewBox', `0 0 ${width} ${height}`);
            this.update(this.parentNode);
        });

        resizeObserver.observe(this.container);
    }

    _getDimensions() {
        const containerRect = this.container.getBoundingClientRect();
        return {
            width: containerRect.width,
            height: containerRect.height
        };
    }
}

export { loadD3 };
