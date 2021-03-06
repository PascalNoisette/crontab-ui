// Program starts here. Creates a sample graph in the
// DOM node with the specified ID. This function is invoked
// from the onLoad event handler of the document (see below).

var JOB_WIDTH = 80;
var JOB_HEIGHT = 100;
var JOB_SPACER = 25;
var POOL_LANE_LENGTH = 80/100 * window.innerWidth;

function loadGraphFromCrontabs(container, crontabs, routes)
{
    // Checks if the browser is supported
    if (!mxClient.isBrowserSupported())
    {
        // Displays an error message if the browser is not supported.
        console.error('Browser is not supported!', 200, false);
    }
    else
    {
        // Disables the built-in context menu
        mxEvent.disableContextMenu(container);

        // Creates the graph inside the given container
        var graph = new mxGraph(container);
        graph.setConnectable(true);
        putStyle(graph);
        putEvent(graph);
        putControls(graph, routes);
        putFilter(graph, crontabs);

        // Enables rubberband selection
        new mxRubberband(graph);



        // Gets the default parent for inserting new cells. This
        // is normally the first child of the root (ie. layer 0).
        var parent = graph.getDefaultParent();

        // Adds cells to the model in a single step
        graph.getModel().beginUpdate();

        try
        {

            graph.setAllowDanglingEdges(false);
            graph.setDisconnectOnMove(false);

            crontabs.forEach(function(crontab) {
                let stylesclasses = "";
                if (crontab.code) {
                    stylesclasses += "returncode";
                }
                graph.insertVertex(getPool(graph, crontab), crontab._id, crontab.name, 0, 0, JOB_WIDTH, JOB_HEIGHT, stylesclasses);
            });
            crontabs.forEach(function(sourceJob) {
                if ("trigger" in sourceJob && sourceJob.trigger.forEach) {
                    sourceJob.trigger.forEach(function(targetJobId) {
                        if (graph.getModel().getCell(targetJobId)) {
                            graph.insertEdge(parent, null, '', graph.getModel().getCell(sourceJob._id), graph.getModel().getCell(targetJobId));
                        }
                    });
                }
            });
            applyFilter(graph, crontabs);
            alignPools(graph, parent);
        } catch (e) {
            console.error(e);
        }
        finally
        {
            // Updates the display
            graph.getModel().endUpdate();
        }
    }
};

function alignPools(graph, root) {
    alignChildren(graph, graph.getModel().getChildVertices(root), 0, 0, 0, JOB_HEIGHT + JOB_SPACER, alignJob);
}
function alignJob(graph, onePool) {

    if (graph.getModel().getChildVertices(onePool)) {
        graph.getModel().getChildVertices(onePool).map(node=>moveNodeUnderParent(node, graph));
        alignChildren(graph, graph.getModel().getChildVertices(onePool), JOB_SPACER, 0, JOB_SPACER+JOB_HEIGHT, 0, function(){});
    }
}
function moveNodeUnderParent(node, graph) {
    var nodeConnection = 0;
    graph.getModel().getEdges(node).forEach(function(edge) {
        if (edge.source.id == node.id) {
            nodeConnection++;
            var position = edge.target.geometry.x - edge.source.geometry.x + 2*JOB_SPACER;
            var offset = nodeConnection*2*JOB_SPACER;
            if (position<=offset ) {
                let toOffet = offset-position;
                edge.target.alreadyOffset = offset;
                graph.moveCells([edge.target], toOffet, 0, false);
            }
        }
    });
}
function alignChildren(graph, children, x, y, xOffset, yOffset, childrenCallback) {
    if (children) {
        let previousCell = null;
        children.forEach(function (cell){
            if (previousCell == null) {
                previousCell = cell;
                childrenCallback(graph, cell);
                return;
            }
            if (typeof(cell.alreadyOffset) == "undefined") {
                cell.alreadyOffset=0;
            }
            graph.moveCells(
                [cell], 
                Math.max(0,previousCell.geometry.x-cell.geometry.x+xOffset+x-cell.alreadyOffset), 
                Math.max(0, previousCell.geometry.y-cell.geometry.y+yOffset+y),
                false
            );
            previousCell = cell;
            childrenCallback(graph, cell);
        });
    }
    return [x, y];
}
function getPool(graph, crontab) {
    if (typeof(graph.getModel().getCell(getPoolName(crontab))) == "undefined") {
        let pool = graph.insertVertex(graph.getDefaultParent(), getPoolName(crontab), getPoolName(crontab), 0, 0, POOL_LANE_LENGTH, JOB_HEIGHT, mxConstants.SHAPE_SWIMLANE)
        pool.setConnectable(false);
    }
    return graph.getModel().getCell(getPoolName(crontab));
}
function getPoolName(crontab)
{
    if ("remote" in crontab) {
        if (crontab.remote_ssh_enabled=="on") {
            var name = crontab.remote.ssh.server;
            if (/@/.test(name)) {
                name = crontab.remote.ssh.server.split("@")[1];
            }
            return name.substring(0,15);
        }
        if (crontab.remote_docker_enabled=="on") {
            return crontab.remote.docker.image.substring(0,15);
        }
    }
    return "local";
}

function putControls(graph, routes)
{


    // Specifies the URL and size of the new control
    var controls = {
        "startControl" : {
            "image": new mxImage('images/submenu.gif', 16, 16),
            "condition" : function (graph, cell) {
                let running = false;
                let stopped = false;
                let sync    = false;
                let name = "";
                crontabs.forEach(function(crontab) {
                    if (crontab._id==cell.id) {
                        running = "pid" in crontab && crontab.pid !== null;
                        stopped = crontab.stopped === "true";
                        sync = crontab.sync != false;
                        return;
                    }
                });
                return cell.style != mxConstants.SHAPE_SWIMLANE
                    && graph.getModel().isVertex(cell)
                    && !running
                    && !stopped
                    && sync;
            },
            "behavior": function (graph, state)
            {
                return function (evt) {
                    if (graph.isEnabled())
                    {
                        runJob(state.cell.id);
                        graph.selectCellForEvent(state.cell, evt);
                        mxEvent.consume(evt);
                    }
                };
            }
        },
        "viewLogControl" : {
            "image": new mxImage('images/maximize.gif', 16, 16),
            "condition" : function (graph, cell) {
                let exist = false;
                crontabs.forEach(function(crontab) {
                    if (crontab._id==cell.id) {
                        exist = true;
                        return;
                    }
                });
                return cell.style != mxConstants.SHAPE_SWIMLANE
                    && graph.getModel().isVertex(cell)
                    && exist;
            },
            "behavior": function (graph, state)
            {
                return function (evt) {
                    if (graph.isEnabled())
                    {
                        window.open(routes.logger + '?id=' + state.cell.id)
                        graph.selectCellForEvent(state.cell, evt);
                        mxEvent.consume(evt);
                    }
                };
            }
        }
    };

    // Overridden to add an additional control to the state at creation time
    mxCellRendererCreateControl = mxCellRenderer.prototype.createControl;
    mxCellRenderer.prototype.createControl = function(state)
    {
        mxCellRendererCreateControl.apply(this, arguments);

        var graph = state.view.graph;

        for (let control in controls) {
            if (controls[control].condition(graph, state.cell))
            {
                if (state[control] == null)
                {
                    var b = new mxRectangle(0, 0, controls[control].image.width, controls[control].image.height);
                    state[control] = new mxImageShape(b, controls[control].image.src);
                    state[control].dialect = graph.dialect;
                    state[control].preserveImageAspect = false;

                    this.initControl(state, state[control], false, controls[control].behavior(graph, state));
                }
            }
            else if (state[control] != null)
            {
                state[control].destroy();
                state[control] = null;
            }
        }
    };

    // Helper function to compute the bounds of the control
    var getControlBounds = function(state, control, index)
    {
        if (state[control] != null)
        {
            var oldScale = state[control].scale;
            var w = state[control].bounds.width / oldScale;
            var h = state[control].bounds.height / oldScale;
            var s = state.view.scale;

            return (state.view.graph.getModel().isEdge(state.cell)) ?
                new mxRectangle(state.x + state.width / 2 - w / 2 * s ,
                    state.y + state.height / 2 - h / 2 * s, w * s, h * s)
                : new mxRectangle(state.x + state.width - w * s - w*index,
                    state.y, w * s, h * s);
        }

        return null;
    };

    // Overridden to update the scale and bounds of the control
    mxCellRendererRedrawControl = mxCellRenderer.prototype.redrawControl;
    mxCellRenderer.prototype.redrawControl = function(state)
    {
        mxCellRendererRedrawControl.apply(this, arguments);


        var index = 0;
        for (var control in controls) {
            if (state[control] != null)
            {
                var bounds = getControlBounds(state, control, index++);
                var s = state.view.scale;

                if (state[control].scale != s || !state[control].bounds.equals(bounds))
                {
                    state[control].bounds = bounds;
                    state[control].scale = s;
                    state[control].redraw();
                }
            }
        }
    };

    // Overridden to remove the control if the state is destroyed
    mxCellRendererDestroy = mxCellRenderer.prototype.destroy;
    mxCellRenderer.prototype.destroy = function(state)
    {
        mxCellRendererDestroy.apply(this, arguments);

        for (var control in controls) {
            if (state[control] != null)
            {
                state[control].destroy();
                state[control] = null;
            }
        }
    };

}
function putStyle(graph)
{
    style = [];
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_SWIMLANE;
    style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter;
    style[mxConstants.STYLE_STROKECOLOR] = '#a0a0a0';
    style[mxConstants.STYLE_FONTCOLOR] = '#606060';
    style[mxConstants.STYLE_FILLCOLOR] = '#E0E0DF';
    style[mxConstants.STYLE_GRADIENTCOLOR] = 'white';
    style[mxConstants.STYLE_STARTSIZE] = 30;
    style[mxConstants.STYLE_ROUNDED] = false;
    style[mxConstants.STYLE_FONTSIZE] = 12;
    style[mxConstants.STYLE_FONTSTYLE] = 0;
    style[mxConstants.STYLE_HORIZONTAL] = false;
    // To improve text quality for vertical labels in some old IE versions...
    style[mxConstants.STYLE_LABEL_BACKGROUNDCOLOR] = '#efefef';

    graph.getStylesheet().putCellStyle(mxConstants.SHAPE_SWIMLANE, style);

    var style = [];
    style[mxConstants.STYLE_FILLCOLOR] = '#ED4337';
    graph.getStylesheet().putCellStyle('returncode', style);

               
    style = graph.getStylesheet().getDefaultEdgeStyle();                     
    style[mxConstants.STYLE_CURVED] = '1';                                   
    style[mxConstants.STYLE_EDGE] = mxEdgeStyle.SegmentConnector;   
}

function selectCorrepondingRow(cell) {
    var correspondingRow = $("[data-original-title=\"" + cell.id + "\"]").parents("tr")[0];
    if (correspondingRow)
        correspondingRow.classList.add("graph-selected");
}

function putEvent(graph)
{


    var style = document.createElement('style');
    style.innerHTML =
        '.graph-selected {' +
        '    background-color: #00ff00 !important;'
        '}';
    document.body.appendChild(style);

    graph.getSelectionModel().addListener(mxEvent.CHANGE, function(sender, evt)
    {
        var cells = evt.getProperty('removed');
        $("tr").each(function (f, e) {e.classList.remove("graph-selected")})
        if (cells)
            for (var i = 0; i < cells.length; i++)
            {
                selectCorrepondingRow(cells[i])
            }
    });

    graph.addListener(mxEvent.DOUBLE_CLICK, function(sender, evt)
    {
        var me = evt.getProperty('event');
        var cell = evt.getProperty('cell');


        if (cell != null)
        {
            editJob(cell.id);
            evt.consume();
        }


    });

    // Restores focus on graph container and removes text input from DOM
    mxEvent.addListener(document, 'keyup', function(evt)
    {

        if (evt.code == "Delete")
        {
            graph.getSelectionCells().forEach(function(cell) {
                crontabs.forEach(function(crontab) {
                    if (cell.vertex == true && cell.id == crontab._id) {
                        deleteJob(crontab._id);
                        return;
                    } else if (cell.edge == true && cell.source.id == crontab._id) {
                        crontab.trigger = crontab.trigger.filter(function (id) {return id != cell.target.id;});
                        if (crontab.trigger.length == 0) {
                            crontab.trigger = "";
                        }
                        $.post(routes.save, {_id: crontab._id, trigger: crontab.trigger}, function(){
                            location.reload();
                        });
                        return;
                    }
                });
            });
        }

    });

    graph.connectionHandler.addListener(mxEvent.CONNECT, function(sender, evt)
    {
        var edge = evt.getProperty('cell');
        var source = graph.getModel().getTerminal(edge, true);
        var target = graph.getModel().getTerminal(edge, false);

        crontabs.forEach(function(crontab) {
            if (source.id == crontab._id) {
                if (!("trigger" in crontab && crontab.trigger.push)) {
                    crontab.trigger = [];
                }
                crontab.trigger.push(target.id);
                $.post(routes.save, {_id: crontab._id, trigger: crontab.trigger}, function(){
                    location.reload();
                });
                return;
            }
        });
    });

}


function applyFilter(graph, crontabs) {
    var hash = window.location.hash;
    var parents = new Set();
    crontabs.forEach(function(crontab) {
        let visible = true;
        if (typeof(hash) != "undefined" && hash.length>0 && "#" + crontab.project != hash) {
            visible = false;
        }
        let cell = graph.getModel().getCell(crontab._id);
        if (typeof(cell) == "undefined")
            return;
        graph.toggleCells(visible, [cell], true);
        parents.add(cell.parent);
        
    });
    parents.forEach(function(parent){
        graph.toggleCells(graph.getChildVertices(parent).length, [parent], true);
    })
    crontabs.forEach(function(crontab) {
        let cell = graph.getModel().getCell(crontab._id);
        if (typeof(cell) == "undefined")
            return;
        graph.getModel().getEdges(cell).forEach(function(edge) {
            edge.setVisible(edge.target.visible && edge.source.visible);
        });
    });
    graph.refresh();
}
function putFilter(graph, crontabs) {
    $(window).on('hashchange', function(){
        applyFilter(graph, crontabs);
    });

}