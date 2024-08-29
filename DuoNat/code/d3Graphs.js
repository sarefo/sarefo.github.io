import logger from './logger.js';
import phylogenySelector from './phylogenySelector.js';
import state from './state.js';
import utils from './utils.js';

let d3;
let useHierarchicalLayout = false; 

async function loadD3() {
    if (!d3) {
        d3 = await import('https://cdn.jsdelivr.net/npm/d3@7/+esm');
    }
    return d3;
}

class BaseTree {
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

    _handleClick(d) {
        logger.debug(`Clicked node: Taxon ID = ${d.data.id}, Taxon Name = ${d.data.taxonName}`);

        if (d === this.activeNode) {
            logger.debug("Active node is not clickable.");
            return;
        }

        if (d.data.taxonName === "Life") {
            logger.debug("Life node clicked. Clearing selection.");
            phylogenySelector.clearSelection();
            return;
        }

        if (d !== this.parentNode) {
            this.parentNode = d.parent || this.parentNode;
            this.activeNode = d;
        } else if (d.parent) {
            this.parentNode = d.parent;
            this.activeNode = d;
        }

        if (d._children) {
            d.children = d._children;
            d._children = null;
        }

        this.update(this.activeNode);

        if (this.onNodeSelect) {
            this.onNodeSelect(this.activeNode.data.id);
        }
        state.setCurrentActiveNodeId(this.activeNode.data.id);
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

class RadialTree extends BaseTree {
    constructor(container, rootNode, showTaxonomicNames) {
        super(container, rootNode);
        this.showTaxonomicNames = showTaxonomicNames;
        this.parentNode = null;
        this.activeNode = null;
        this.dragOffset = [0, 0];
        this.onNodeSelect = null;
        this.simulation = null;
        this.initialDrag = true;
        this.maxDepth = 0;
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
                utils.string.truncate(d.data.vernacularName,24) : d.data.taxonName)
            .attr('title', d => !this.showTaxonomicNames && d.data.vernacularName && d.data.vernacularName !== "-" ? 
                d.data.taxonName : utils.string.truncate(d.data.vernacularName,24));
    }

    async create() {
        if (!await this.initialize()) return;

        const { width, height } = this._getDimensions();
        this._setupSvg(width, height);
        this._addStyles();
        this._setupDrag();

        this.parentNode = this.root;
        this.activeNode = this.root;
        this.treeLayout = this._setupTreeLayout();

        this.root.descendants().forEach(d => {
            if (d.depth > 0) {
                d._children = d.children;
                d.children = null;
            }
        });

        this._setupSimulation();
        this.update(this.root);
        this._setupResizeObserver();
    }

    _setupSimulation() {
        this.simulation = this.d3.forceSimulation()
            .force("link", this.d3.forceLink().id(d => d.data.id).distance(this.radius / 2))
            .force("charge", this.d3.forceManyBody().strength(-30))
            .force("collide", this.d3.forceCollide(30))
            .force("radial", this.d3.forceRadial(d => d.depth * this.radius / 2).strength(0.8))
            .force("center", this.d3.forceCenter(0, 0));
    }

    _centerGraphOnActiveNode() {
        const activeNodeCoords = this._radialPoint(this.activeNode.x, this.activeNode.y);
        const { width, height } = this._getDimensions();

        this.dragOffset = [
            width / 2 - activeNodeCoords[0],
            height / 2 - activeNodeCoords[1]
        ];

        this.svg.transition()
            .duration(750)
            .attr('transform', `translate(${this.dragOffset[0]},${this.dragOffset[1]})`);
    }

    _setupZoom() {
        this.zoom = this.d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                this.zoomG.attr("transform", event.transform);
            });

        this.d3.select(this.container).select("svg")
            .call(this.zoom)
            .on("dblclick.zoom", null);
    }

    _redrawGraph() {
        // Remove all existing nodes and links
        this.svg.selectAll('g.node').remove();
        this.svg.selectAll('path.link').remove();

        // Recompute the layout
        this.treeLayout(this.parentNode);

        // Update the graph
        this.update(this.parentNode);
    }

    _getDimensions() {
        const containerRect = this.container.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;
        //const radius = Math.min(width, height) / 2 - 120;
        return { width, height };
    }

    _setupSvg(width, height) {
        this.d3.select(this.container).selectAll("svg").remove();

        this.svg = this.d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`)
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
        if (this.initialDrag) {
            this.dragOffset = [
                parseFloat(this.svg.attr('transform').split('(')[1].split(',')[0]),
                parseFloat(this.svg.attr('transform').split('(')[1].split(',')[1])
            ];
            this.initialDrag = false;
        }
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
            `);
    }

    _calculateMaxDepth(node, currentDepth = 0) {
        if (!node) return currentDepth;
        this.maxDepth = Math.max(this.maxDepth, currentDepth);
        if (node.children) {
            node.children.forEach(child => this._calculateMaxDepth(child, currentDepth + 1));
        }
    }

    _setupTreeLayout() {
        const { width, height } = this._getDimensions();
        const radius = Math.min(width, height) / 2 - 20; // Use more of the available space
        return this.d3.tree()
            .size([2 * Math.PI, radius])
            .separation((a, b) => {
                return (a.parent == b.parent ? 1 : 2) / a.depth;
            });
    }

    _getVisibleNodes() {
        return [this.parentNode, this.activeNode, ...(this.activeNode.children || [])];
    }

    _getVisibleLinks(visibleNodes) {
        return this.parentNode.links().filter(link =>
            visibleNodes.includes(link.source) && visibleNodes.includes(link.target)
        );
    }

    _normalizeDepth(visibleNodes) {
        const maxDepth = Math.max(...visibleNodes.map(d => d.depth - this.parentNode.depth));
        visibleNodes.forEach(d => {
            d.y = ((d.depth - this.parentNode.depth) / maxDepth);
        });
    }

    _updateNodes(visibleNodes, source, duration) {
        const maxCount = Math.max(...visibleNodes.map(d => d.data.pairCount));
        const node = this.svg.selectAll('g.node')
            .data(visibleNodes, d => d.data.id);

        const nodeEnter = node.enter().append('g')
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => `translate(${this._radialPoint(source.x0 || 0, source.y0 || 0)})`)
            .on('click', (event, d) => this._handleClick(d));

        // circle around all nodes
        nodeEnter.append('circle')
            .attr('r', d => this.calculateRadius(d.data.pairCount, maxCount))
            .style('fill', d => d._children ? '#dfe9c8' : '#fff')
            .style('stroke', '#74ac00')
            .style('stroke-width', '1.5px');

        nodeEnter.append('text')
            .attr('dy', d => {
                const radius = this.calculateRadius(d.data.pairCount, maxCount);
                return -radius - 5; // Position text 5px above the circle's border
            })
            .attr('x', 0)
            .attr('text-anchor', 'middle')
            /*.text(d => `${d.data.taxonName} (${d.data.pairCount})`)*/ // with number of taxa in brackets
            .text(d => !this.showTaxonomicNames && d.data.vernacularName && d.data.vernacularName !== "-" ? 
                utils.string.truncate(d.data.vernacularName,24) : d.data.taxonName)
            .style('fill-opacity', 1e-6);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => `translate(${this._radialPoint(d.x, d.y)})`);

        nodeUpdate.select('circle')
            .attr('r', d => this.calculateRadius(d.data.pairCount, maxCount))
            .style('fill', d => d === this.parentNode ? '#74ac00' : (d._children ? '#dfe9c8' : '#fff'));

        nodeUpdate.select('text')
            .text(d => !this.showTaxonomicNames && d.data.vernacularName && d.data.vernacularName !== "-" ? 
                utils.string.truncate(d.data.vernacularName,24) : d.data.taxonName)
            .style('fill-opacity', 1)
            .attr('dy', d => {
                const radius = this.calculateRadius(d.data.pairCount, maxCount);
                return -radius - 5; // Update position during transitions
            })
            .attr('x', 0)
            .style('font-weight', d => (d === this.parentNode || d === this.activeNode) ? 'bold' : 'normal')
            .style('fill', d => {
                if (d === this.parentNode) return '#74ac00';
                if (d === this.activeNode) return '#ac0028';
                return 'black';
            });

        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr('transform', d => `translate(${this._radialPoint(source.x, source.y)})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 1e-6);
    }


    _updateLinks(links, source, duration) {
        const link = this.svg.selectAll('path.link')
            .data(links, d => d.target.data.id);

        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = { x: source.x0 || 0, y: source.y0 || 0 };
                return this._diagonal(o, o);
            });

        link.merge(linkEnter).transition()
            .duration(duration)
            .attr('d', d => {
                const sourcePoint = this._radialPoint(d.source.x, d.source.y);
                const targetPoint = this._radialPoint(d.target.x, d.target.y);
                return `M${sourcePoint[0]},${sourcePoint[1]}L${targetPoint[0]},${targetPoint[1]}`;
            });

        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return this._diagonal(o, o);
            })
            .remove();
    }

    _diagonal(source, target) {
        const sourcePoint = this._radialPoint(source.x, source.y);
        const targetPoint = this._radialPoint(target.x, target.y);
        return `M${sourcePoint[0]},${sourcePoint[1]}L${targetPoint[0]},${targetPoint[1]}`;
    }

    _radialPoint(x, y) {
        const { width, height } = this._getDimensions();
        const radius = Math.min(width, height) / 2 - 20;
        return [(y * radius) * Math.cos(x - Math.PI / 2), (y * radius) * Math.sin(x - Math.PI / 2)];
    }

    _handleClick(d) {
        logger.debug(`Clicked node: Taxon ID = ${d.data.id}, Taxon Name = ${d.data.taxonName}`);

        if (d === this.activeNode) {
            logger.debug("Active node is not clickable.");
            return;
        }

        if (d.data.taxonName === "Life") {
            logger.debug("Life node clicked. Clearing selection.");
            phylogenySelector.clearSelection();
            return;
        }

        if (d !== this.parentNode) {
            this.parentNode = d.parent || this.parentNode;
            this.activeNode = d;
        } else if (d.parent) {
            this.parentNode = d.parent;
            this.activeNode = d;
        }

        if (d._children) {
            d.children = d._children;
            d._children = null;
        }

        this.update(this.activeNode);
        this._centerGraphOnActiveNode(); // Add this line

        if (this.onNodeSelect) {
            this.onNodeSelect(this.activeNode.data.id);
        }
        state.setCurrentActiveNodeId(this.activeNode.data.id);
    }

    _traverseChildren() {
        let currentNode = this.activeNode;

        // Traverse until we find a node with more than one child or no children
        while (currentNode.children && currentNode.children.length === 1) {
            currentNode = currentNode.children[0];
            this.activeNode = currentNode;

            // Ensure that the current active node's children are expanded
            if (currentNode._children) {
                currentNode.children = currentNode._children;
                currentNode._children = null;
            }
        }
    }

    logTreeStructure() {
        const logNode = (node, depth = 0) => {
            //console.log(' '.repeat(depth * 2) + `${node.data.id}: ${node.data.taxonName}`);
            if (node.children) {
                node.children.forEach(child => logNode(child, depth + 1));
            }
        };
        //console.log("Tree structure:");
        logNode(this.root);
    }

    setActiveNode(nodeId) {
        //console.log(`Attempting to set active node: ${nodeId}`);
        this.logTreeStructure(); // Log the tree structure for debugging
        state.setCurrentActiveNodeId(nodeId);

        const node = this.root.descendants().find(d => d.data.id === nodeId);
        if (node) {
            //console.log(`Found node: ${node.data.taxonName}`);
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
        //console.log(`setActiveNodePath called with: ${pathToRoot.join(' -> ')}`);
        
        let currentNode = this.root;
        for (let i = 1; i < pathToRoot.length; i++) {  // Start from 1 to skip the root
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
            //console.log(`Found target node: ${currentNode.data.taxonName}`);
            this.parentNode = currentNode.parent || this.root;
            this.activeNode = currentNode;

            // Expand children of the active node
            if (this.activeNode._children) {
                this.activeNode.children = this.activeNode._children;
            }

            // If the active node has no children, expand its siblings
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
            this.logTreeStructure();
        }
    }

    update(source) {
        const duration = 750;
        
        this.maxDepth = 0; // Reset maxDepth
        this._calculateMaxDepth(this.parentNode); // Recalculate maxDepth

        this.treeLayout = this._setupTreeLayout(); // Update layout with new maxDepth
        this.treeLayout(this.parentNode);

        const visibleNodes = this._getVisibleNodes();
        const links = this._getVisibleLinks(visibleNodes);
        this._normalizeDepth(visibleNodes);

        this.simulation.nodes(visibleNodes);
        this.simulation.force("link").links(links);

        this._updateNodes(visibleNodes, source, duration);
        this._updateLinks(links, source, duration);

        this.simulation.alpha(1).restart();


        // Center the active node on the screen
        const activeNodeCoords = this._radialPoint(this.activeNode.x, this.activeNode.y);
        const svgGroupTransform = `translate(${this.dragOffset[0] + this.container.clientWidth / 2 - activeNodeCoords[0]},${this.dragOffset[1] + this.container.clientHeight / 2 - activeNodeCoords[1]})`;

        //this.svg.transition()
        //    .duration(duration)
        //    .attr('transform', svgGroupTransform);

        // Fit the graph to view
        this._fitToView();

        // style active note
        this.svg.selectAll('.node')
            .filter(d => d === this.activeNode)
            .raise() // Bring the active node to the front
            .select('circle')
            .transition()
            .duration(duration)
            .style('stroke', '#ac0028')
            .attr('r', 8) // Make the active node slightly larger
            .style('fill', '#ac0028'); // Highlight color

        this._centerGraphOnActiveNode();
    }

    _fitToView() {
        const bounds = this.svg.node().getBBox();
        const parent = this.svg.node().parentElement;
        const fullWidth = parent.clientWidth;
        const fullHeight = parent.clientHeight;
        const width = bounds.width;
        const height = bounds.height;
        const midX = bounds.x + width / 2;
        const midY = bounds.y + height / 2;

        if (width === 0 || height === 0) return; // nothing to fit

        const scale = 0.95 / Math.max(width / fullWidth, height / fullHeight);
        const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

        const transform = this.d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale);

        this.d3.select(parent)
            .transition()
            .duration(750)
            .call(this.d3.zoom().transform, transform);
    }

    _setupResizeObserver() {
        const resizeObserver = new ResizeObserver(() => {
            const { width, height, radius } = this._getDimensions();
            this.svg.attr('viewBox', `0 0 ${width} ${height}`);
            this.svg.attr('transform', `translate(${width / 2},${height / 2})`);
            this.treeLayout.size([2 * Math.PI, radius]);
            this.update(this.parentNode);
        });

        resizeObserver.observe(this.container);
    }

}

class HierarchicalTree extends BaseTree {
    constructor(container, rootNode, showTaxonomicNames) {
        super(container, rootNode, showTaxonomicNames);
        this.nodeWidth = 200;
        this.nodeHeight = 50;
        this.margin = {top: 20, right: 90, bottom: 30, left: 90};
    }

    async create() {
        if (!await this.initialize()) return;

        const { width, height } = this._getDimensions();
        this._setupSvg(width, height);
        this._addStyles();
        this._setupDrag();

        this.parentNode = this.root;
        this.activeNode = this.root;
        this.treeLayout = this._setupTreeLayout();

        this.root.x0 = height / 2;
        this.root.y0 = 0;

        this.root.descendants().forEach(d => {
            if (d.depth > 0) {
                d._children = d.children;
                d.children = null;
            }
        });

        this.update(this.root);
        this._setupResizeObserver();
    }

    _setupTreeLayout() {
        return this.d3.tree()
            .nodeSize([this.nodeHeight, this.nodeWidth])
            .separation((a, b) => (a.parent == b.parent ? 1 : 1.5));
    }

    _setupSvg(width, height) {
        this.d3.select(this.container).selectAll("svg").remove();

        this.svg = this.d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    }

    _getVisibleNodes() {
        if (this.activeNode === this.root) {
            return [this.root, ...this.root.children];
        }
        return [this.parentNode, this.activeNode, ...(this.activeNode.children || [])];
    }

    _getVisibleLinks(visibleNodes) {
        return visibleNodes.slice(1).map(node => ({
            source: node.parent || this.parentNode,
            target: node
        }));
    }

    _updateNodes(visibleNodes, source, duration) {
        const maxCount = Math.max(...visibleNodes.map(d => d.data.pairCount));
        const node = this.svg.selectAll('g.node')
            .data(visibleNodes, d => d.data.id);

        const nodeEnter = node.enter().append('g')
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => `translate(${source.x0 || 0},${source.y0 || 0})`)
            .on('click', (event, d) => this._handleClick(d));

        nodeEnter.append('circle')
            .attr('r', d => this.calculateRadius(d.data.pairCount, maxCount))
            .style('fill', d => d._children ? '#dfe9c8' : '#fff');

        nodeEnter.append('text')
            .attr('dy', d => {
                const radius = this.calculateRadius(d.data.pairCount, maxCount);
                return -radius - 5;
            })
            .attr('x', d => d.children || d._children ? -10 : 10)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .text(d => !this.showTaxonomicNames && d.data.vernacularName && d.data.vernacularName !== "-" ? 
                utils.string.truncate(d.data.vernacularName, 24) : d.data.taxonName)
            .style('fill-opacity', 1e-6);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => {
                if (typeof d.x === 'undefined' || typeof d.y === 'undefined') {
                    console.error("Node without coordinates:", d);
                    return 'translate(0,0)';
                }
                return `translate(${d.x},${d.y})`;
            });

        nodeUpdate.select('circle')
            .attr('r', d => this.calculateRadius(d.data.pairCount, maxCount))
            .style('fill', d => d === this.parentNode ? '#74ac00' : (d._children ? '#dfe9c8' : '#fff'));

        nodeUpdate.select('text')
            .style('fill-opacity', 1)
            .attr('dy', d => {
                const radius = this.calculateRadius(d.data.pairCount, maxCount);
                return -radius - 5;
            })
            .attr('x', d => d.children || d._children ? -10 : 10)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .style('font-weight', d => (d === this.parentNode || d === this.activeNode) ? 'bold' : 'normal')
            .style('fill', d => {
                if (d === this.parentNode) return '#74ac00';
                if (d === this.activeNode) return '#ac0028';
                return 'black';
            });

        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr('transform', d => `translate(${source.x},${source.y})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        // Update node positions and labels
        nodeUpdate.attr("transform", d => {
            let x = d.x;
            let y = d.y;
            if (d === this.parentNode) {
                x = 0;
                y = 0;
            } else if (d === this.activeNode) {
                x = this.nodeHeight;
                y = this.nodeWidth / 2;
            }
            return `translate(${y},${x})`;
        });

        // Update text position
        nodeUpdate.select('text')
            .attr("dy", ".35em")
            .attr("x", d => 15) // Place text to the right of the node
            .attr("text-anchor", "start");
    }

    _updateLinks(links, source, duration) {
        const link = this.svg.selectAll('path.link')
            .data(links, d => d.target.data.id);

        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = { x: source.x0 || 0, y: source.y0 || 0 };
                return this._diagonal(o, o);
            });

    link.merge(linkEnter).transition()
        .duration(duration)
        .attr('d', d => {
            if (!d.source.x || !d.source.y || !d.target.x || !d.target.y) {
                console.error("Link with undefined coordinates:", d);
                return 'M0,0L0,0';
            }
            return this._diagonal(d.source, d.target);
        });

        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return this._diagonal(o, o);
            })
            .remove();

        // Update link paths
        linkUpdate.attr('d', d => {
            let sourceX = d.source.x;
            let sourceY = d.source.y;
            let targetX = d.target.x;
            let targetY = d.target.y;

            if (d.source === this.parentNode) {
                sourceX = 0;
                sourceY = 0;
            } else if (d.source === this.activeNode) {
                sourceX = this.nodeHeight;
                sourceY = this.nodeWidth / 2;
            }

            if (d.target === this.activeNode) {
                targetX = this.nodeHeight;
                targetY = this.nodeWidth / 2;
            }

            return `M${sourceY},${sourceX}
                    C${sourceY},${(sourceX + targetX) / 2}
                     ${targetY},${(sourceX + targetX) / 2}
                     ${targetY},${targetX}`;
        });
    }

    update(source) {
        const duration = 750;
        
        const { width, height } = this._getDimensions();

        // Get visible nodes and links
        const visibleNodes = this._getVisibleNodes();
        const links = this._getVisibleLinks(visibleNodes);

        // Assigns the x and y position for the nodes
        this.treeLayout(this.parentNode);

        // Normalize for fixed-depth and position nodes
        this._positionNodes(visibleNodes);

        // Update the nodes...
        this._updateNodes(visibleNodes, source, duration);

        // Update the links...
        this._updateLinks(links, source, duration);

        // Store the old positions for transition.
        visibleNodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        console.log('Tree update complete. Parent node:', this.parentNode);
        console.log('Visible nodes:', visibleNodes.length);
        console.log('Visible links:', links.length);
    }

    _positionNodes(nodes) {
        nodes.forEach(d => {
            if (d === this.parentNode) {
                d.y = 0;
                d.x = 0;
            } else if (d === this.activeNode) {
                d.y = this.nodeWidth / 2;
                d.x = this.nodeHeight;
            } else {
                d.y = this.nodeWidth;
                // Distribute child nodes evenly
                const childIndex = this.activeNode.children ? this.activeNode.children.indexOf(d) : 0;
                const totalChildren = this.activeNode.children ? this.activeNode.children.length : 1;
                d.x = this.nodeHeight * 2 + (childIndex + 1) * (this.nodeHeight * 2) / (totalChildren + 1);
            }
            // Ensure x and y are numbers
            d.x = isNaN(d.x) ? 0 : d.x;
            d.y = isNaN(d.y) ? 0 : d.y;
        });
    }

    _enterNodes(node, source) {
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr("transform", d => `translate(${source.y0 || 0},${source.x0 || 0})`)
            .on('click', (event, d) => this._handleClick(d));

        nodeEnter.append('circle')
            .attr('class', 'node')
            .attr('r', 1e-6)
            .style("fill", d => d._children ? "lightsteelblue" : "#fff");

        nodeEnter.append('text')
            .attr("dy", ".35em")
            .attr("x", 15)
            .attr("text-anchor", "start")
            .text(d => d.data.taxonName)
            .style('fill-opacity', 0);

        return nodeEnter;
    }

    _updateNodes(visibleNodes, source, duration) {
        const node = this.svg.selectAll('g.node')
            .data(visibleNodes, d => d.data.id);

        const nodeEnter = this._enterNodes(node, source);
        const nodeUpdate = this._updateExistingNodes(nodeEnter.merge(node), duration);
        this._exitNodes(node, source, duration);

        return nodeUpdate;
    }

    _updateExistingNodes(nodeUpdate, duration) {
        nodeUpdate.transition()
            .duration(duration)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('circle.node')
            .attr('r', 10)
            .style("fill", d => d._children ? "lightsteelblue" : "#fff")
            .attr('cursor', 'pointer');

        nodeUpdate.select('text')
            .style('fill-opacity', 1);

        return nodeUpdate;
    }

    _exitNodes(node, source, duration) {
        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 0);
    }

    _enterLinks(link, source) {
        return link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = { x: source.x0 || 0, y: source.y0 || 0 };
                return this._diagonal(o, o);
            });
    }

    _updateLinks(links, source, duration) {
        const link = this.svg.selectAll('path.link')
            .data(links, d => d.target.data.id);

        const linkEnter = this._enterLinks(link, source);
        this._updateExistingLinks(linkEnter.merge(link), duration);
        this._exitLinks(link, source, duration);
    }

    _updateExistingLinks(linkUpdate, duration) {
        linkUpdate.transition()
            .duration(duration)
            .attr('d', d => this._diagonal(d.source, d.target));
    }

    _exitLinks(link, source, duration) {
        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = {x: source.x || 0, y: source.y || 0};
                return this._diagonal(o, o);
            })
            .remove();
    }

    _diagonal(s, d) {
        const sx = isNaN(s.x) ? 0 : s.x;
        const sy = isNaN(s.y) ? 0 : s.y;
        const dx = isNaN(d.x) ? 0 : d.x;
        const dy = isNaN(d.y) ? 0 : d.y;
        return `M ${sy},${sx}
                C ${(sy + dy) / 2},${sx},
                  ${(sy + dy) / 2},${dx},
                  ${dy},${dx}`;
    }
}

const publicAPI = {
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

    loadD3: loadD3,

};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(publicAPI);
    }
});

export default publicAPI
