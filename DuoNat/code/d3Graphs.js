import logger from './logger.js';

let d3;

async function loadD3() {
    if (!d3) {
        d3 = await import('https://cdn.jsdelivr.net/npm/d3@7/+esm');
    }
    return d3;
}

class BaseTree {
    constructor(container, rootNode) {
        this.container = container;
        this.rootNode = rootNode;
        this.svg = null;
        this.treeLayout = null;
        this.d3 = null;
        this.root = null;
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
        this.svg = this.d4.select(this.container)
            .append('svg')
            .attr('width', '101%')
            .attr('height', '101%')
            .attr('viewBox', `1 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .append('g')
            .attr('transform', `translate(${width / 3},${height / 2})`);
    }

    _setupTreeLayout(width, height) {
        // Default implementation, can be overridden by subclasses
        return this.d3.tree().size([height, width]);
    }

    _addStyles() {
        // Default styles, can be overridden or extended by subclasses
        this.svg.append('style').text(`
            .node circle {
                fill: #fff;
                stroke: steelblue;
                stroke-width: 3px;
            }
            .node text {
                font: 12px sans-serif;
            }
            .link {
                fill: none;
                stroke: #ccc;
                stroke-width: 2px;
            }
        `);
    }

    _updateNodes(nodes, source, duration) {
        // This method should be implemented by subclasses
        throw new Error('_updateNodes must be implemented by subclass');
    }

    _updateLinks(links, source, duration) {
        // This method should be implemented by subclasses
        throw new Error('_updateLinks must be implemented by subclass');
    }

    update(source) {
        // Default implementation, can be overridden by subclasses
        const duration = 750;
        const nodes = this.root.descendants();
        const links = this.root.links();

        this._updateNodes(nodes, source, duration);
        this._updateLinks(links, source, duration);
    }

    _getDimensions() {
        const containerRect = this.container.getBoundingClientRect();
        return {
            width: containerRect.width,
            height: containerRect.height
        };
    }

    _setupResizeObserver() {
        const resizeObserver = new ResizeObserver(() => {
            const { width, height } = this._getDimensions();
            this.svg.attr('width', width).attr('height', height);
            this.treeLayout.size([height, width - 200]);
            this.update(this.root);
        });

        resizeObserver.observe(this.container);
    }

    async create() {
        if (!await this.initialize()) return;

        const { width, height } = this._getDimensions();
        this._setupSvg(width, height);
        this._addStyles();
        this.treeLayout = this._setupTreeLayout(width, height);
        this.update(this.root);
        this._setupResizeObserver();
    }
}

class RadialTree extends BaseTree {
    constructor(container, rootNode) {
        super(container, rootNode);
        this.parentNode = null;
        this.activeNode = null;
        this.dragOffset = [0, 0];
    }

    async create() {
        if (!await this.initialize()) return;

        const { width, height, radius } = this._getDimensions();
        this._setupSvg(width, height);
        this._addStyles();
        this._setupDrag();

        this.parentNode = this.root;
        this.activeNode = this.root;
        this.treeLayout = this._setupTreeLayout(radius);

        // Initialize nodes directly here instead of calling _initializeNodes
        this.root.descendants().forEach(d => {
            if (d.depth > 0) {
                d._children = d.children;
                d.children = null;
            }
        });

        this.update(this.root);
        this._setupResizeObserver();
    }

    _getDimensions() {
        const containerRect = this.container.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;
        const radius = Math.min(width, height) / 2 - 120;
        return { width, height, radius };
    }

    _setupSvg(width, height) {
        // Remove any existing SVG elements
        this.d3.select(this.container).selectAll("svg").remove();

        this.svg = this.d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`)
            .attr('class', 'draggable-group');

        // Add styles directly to the SVG
        this.svg.append('style').text(`
            .link {
                fill: none;
                stroke: #ccc;
                stroke-width: 1.5px;
            }
            .node text {
                font: 16px sans-serif;
            }
            .node--central circle {
                fill: #74ac00;
                r: 8;
            }
            .node--central text {
                font-weight: bold;
                fill: #74ac00;
            }
            .node--active circle {
                stroke: #ff6600;
                stroke-width: 3px;
            }
            .node--active text {
                fill: #ff6600;
                font-weight: bold;
            }
        `);
    }

    _setupDrag() {
        const drag = this.d3.drag()
            .on('start', this._dragStarted.bind(this))
            .on('drag', this._dragged.bind(this))
            .on('end', this._dragEnded.bind(this));

        this.svg.call(drag);
    }

    _dragStarted() {
        this.d3.select(this.container).style('cursor', 'grabbing');
    }

    _dragged(event) {
        const [x, y] = this.d3.pointer(event, this.svg.node());
        const transform = this.d3.zoomTransform(this.svg.node());
        this.dragOffset[0] += event.dx;
        this.dragOffset[1] += event.dy;
        this.svg.attr('transform', `translate(${this.dragOffset[0] + this.container.clientWidth / 2},${this.dragOffset[1] + this.container.clientHeight / 2})`);
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
            .node text {
                font: 16px sans-serif;
            }
            .node--central circle {
                fill: #74ac00;
                r: 8;
            }
            .node--central text {
                font-weight: bold;
                fill: #74ac00;
            }
            .node--active circle {
                stroke: #ff6600;
                stroke-width: 3px;
            }
            .node--active text {
                fill: #ff6600;
                font-weight: bold;
            }
        `);
    }

    _setupTreeLayout(radius) {
        return this.d3.tree()
            .size([2 * Math.PI, radius])
            .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);
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
        visibleNodes.forEach(d => {
            d.y = (d.depth - this.parentNode.depth) * 100;
        });
    }

    _updateNodes(visibleNodes, source, duration) {
        const node = this.svg.selectAll('g.node')
            .data(visibleNodes, d => d.data.id);

        const nodeEnter = node.enter().append('g')
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => `translate(${this._radialPoint(source.x0 || 0, source.y0 || 0)})`)
            .on('click', (event, d) => this._handleClick(d));

        nodeEnter.append('circle')
            .attr('r', 1e-6)
            .style('fill', d => d._children ? 'lightsteelblue' : '#fff')
            .style('stroke', '#74ac00')
            .style('stroke-width', '1.5px');

        nodeEnter.append('text')
            .attr('dy', '.31em')
            .attr('x', d => d.x < Math.PI === !d.children ? 6 : -6)
            .attr('text-anchor', d => d.x < Math.PI === !d.children ? 'start' : 'end')
            .text(d => d.data.taxonName)
            .style('fill-opacity', 1e-6);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => `translate(${this._radialPoint(d.x, d.y)})`);

        nodeUpdate.select('circle')
            .attr('r', d => d === this.parentNode ? 8 : 5)
            .style('fill', d => d === this.parentNode ? '#74ac00' : (d._children ? 'lightsteelblue' : '#fff'));

        nodeUpdate.select('text')
            .style('fill-opacity', 1)
            .attr('transform', 'translate(0,-20) rotate(0)')
            .attr('text-anchor', 'middle') // Center text horizontally
            .attr('dy', '.35em') // Center text vertically
            .attr('x', 0)
            .style('font-weight', d => (d === this.parentNode || d === this.activeNode) ? 'bold' : 'normal')
            .style('fill', d => {
                if (d === this.parentNode) return '#ff6600';
                if (d === this.activeNode) return '#74ac00';
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
            .attr('d', d => this._diagonal(d.source, d.target));

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
        return [(y = +y) * Math.cos(x -= Math.PI / 2), y * Math.sin(x)];
    }

    _handleClick(d) {
        logger.debug(`Clicked node: Taxon ID = ${d.data.id}, Taxon Name = ${d.data.taxonName}`);
        // If the clicked node is the central node, do nothing for now
        if (d === this.activeNode) {
            logger.debug("Active node is not clickable.");
            return;
        }

        if (d !== this.parentNode) {
            // Make the clicked node's parent the new center node (root)
            this.parentNode = d.parent || this.parentNode;
            this.activeNode = d;
        } else if (d.parent) {
            // If the center node is clicked again, make its parent the new center node
            this.parentNode = d.parent;
            this.activeNode = d;
        }

        // Ensure that the active node's children are always expanded
        if (d._children) {
            d.children = d._children;
            d._children = null;
        }
        /*if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }*/

        // Traverse children if the active node has only one child
        //this._traverseChildren();
        // TODO not ready for primetime yet

        // Update the tree with the new layout and expanded nodes
        this.update(this.activeNode);
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

    setActiveNode(nodeId) {
        const node = this.root.descendants().find(d => d.data.id === nodeId);
        if (node) {
            this._handleClick(node);
        } else {
            logger.warn(`Node with id ${nodeId} not found in the tree`);
        }
    }

    getActiveNodeId() {
        return this.activeNode ? this.activeNode.data.id : null;
    }

    update(source) {
        const duration = 750;
        this.treeLayout(this.parentNode);
        const visibleNodes = this._getVisibleNodes();
        const links = this._getVisibleLinks(visibleNodes);
        this._normalizeDepth(visibleNodes);

        this._updateNodes(visibleNodes, source, duration);
        this._updateLinks(links, source, duration);

        // Store old positions directly here
        visibleNodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        // Center the active node on the screen
        const activeNodeCoords = this._radialPoint(this.activeNode.x, this.activeNode.y);
        const svgGroupTransform = `translate(${this.dragOffset[0] + this.container.clientWidth / 2 - activeNodeCoords[0]},${this.dragOffset[1] + this.container.clientHeight / 2 - activeNodeCoords[1]})`;

        this.svg.transition()
            .duration(duration)
            .attr('transform', svgGroupTransform);
    }

    /*_radialPoint(x, y) {
        return [(y = +y) * Math.cos(x - Math.PI / 2), y * Math.sin(x - Math.PI / 2)];
    }*/

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
    constructor(container, rootNode) {
        super(container, rootNode);
    }

    async create() {
        if (!await this.initialize()) return;

        const width = 800;
        const height = 600;

        this._setupSvg(width, height);
        this._addStyles();
        this.treeLayout = this._setupTreeLayout(width, height);

        this._initializeNodes();
        this._expandInitialNodes();
        this.update(this.root);
    }

    _setupSvg(width, height) {
        this.svg = this.d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', 'translate(40,0)');
    }

    _addStyles() {
        this.svg.append('style').text(`
            .testing-dialog__node circle {
                fill: #fff;
                stroke: steelblue;
                stroke-width: 3px;
            }
            .testing-dialog__node text {
                font: 12px sans-serif;
            }
            .testing-dialog__link {
                fill: none;
                stroke: #ccc;
                stroke-width: 2px;
            }
        `);
    }

    _setupTreeLayout(width, height) {
        return this.d3.tree().size([height, width - 200]);
    }

    _initializeNodes() {
        this.root.descendants().forEach(d => {
            if (d.depth > 1) {
                d._children = d.children;
                d.children = null;
            }
        });
    }

    _expandInitialNodes() {
        this._expandNode(this.root);
        this.root.children.forEach(this._expandNode);
    }

    _expandNode(d) {
        if (d._children) {
            d.children = d._children;
            d.children.forEach(this._expandNode);
        }
    }

    _updateNodes(nodes, links, source, duration) {
        const node = this.svg.selectAll('.testing-dialog__node')
            .data(nodes, d => d.data.id);

        const nodeEnter = node.enter().append('g')
            .attr('class', 'testing-dialog__node')
            .attr('transform', d => {
                const x = isNaN(source.x0) ? 0 : source.x0;
                const y = isNaN(source.y0) ? 0 : source.y0;
                return `translate(${y},${x})`;
            })
            .on('click', (event, d) => {
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                this.update(d);
            });

        nodeEnter.append('circle')
            .attr('r', 1e-6)
            .attr('fill', d => d._children ? "lightsteelblue" : "#fff");

        nodeEnter.append('text')
            .attr('dy', '.35em')
            .attr('x', d => d.children || d._children ? -13 : 13)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .text(d => d.data.taxonName);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('transform', d => {
                if (isNaN(d.x) || isNaN(d.y)) {
                    logger.error('Invalid node position:', d);
                    return 'translate(0,0)';
                }
                return `translate(${d.y},${d.x})`;
            });

        nodeUpdate.select('circle')
            .attr('r', 5)
            .attr('fill', d => d._children ? "lightsteelblue" : "#fff");

        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr('transform', d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        this._updateLinks(links, source, duration);
    }

    _updateLinks(links, source, duration) {
        const link = this.svg.selectAll('.testing-dialog__link')
            .data(links, d => d.target.data.id);

        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'testing-dialog__link')
            .attr('d', d => {
                const o = { x: source.x0, y: source.y0 };
                return this._diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition()
            .duration(duration)
            .attr('d', d => this._diagonal(d.source, d.target));

        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return this._diagonal(o, o);
            })
            .remove();
    }

    _diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    }

    update(source) {
        const duration = 750;
        const tree = this.treeLayout(source);
        const nodes = tree.descendants();
        const links = tree.links();

        nodes.forEach(d => d.y = d.depth * 180);

        this._updateNodes(nodes, links, source, duration);
        this._updateLinks(links, source, duration);

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }
}

const publicAPI = {
    createRadialTree: async function (container, rootNode) {
        const tree = new RadialTree(container, rootNode);
        await tree.create();
        this.lastCreatedTree = tree;
        return tree; // Return the tree instance
    },

    createHierarchicalTree: async function (container, rootNode) {
        const tree = new HierarchicalTree(container, rootNode);
        await tree.create();
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
};

export default publicAPI
