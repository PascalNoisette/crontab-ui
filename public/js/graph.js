// Program starts here. Creates a sample graph in the
// DOM node with the specified ID. This function is invoked
// from the onLoad event handler of the document (see below).
function loadGraphFromCrontabs(container, crontabs)
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

        // Enables rubberband selection
        new mxRubberband(graph);

        // Gets the default parent for inserting new cells. This
        // is normally the first child of the root (ie. layer 0).
        var parent = graph.getDefaultParent();

        // Adds cells to the model in a single step
        graph.getModel().beginUpdate();

        //var lane1a = graph.insertVertex(pool1, null, 'Lane A', 0, 0, 640, 100, mxConstants.SHAPE_SWIMLANE);
        try
        {
            var w = 80;
            var h = 100;
            var space = 20;
            var pools = {
                instances:{},
                xCrontab:{},
                vertex:{},
                yPool:0,
                getPool: function (crontab) {
                    if(!(getPoolName(crontab) in this.instances)) {
                        this.instances[getPoolName(crontab)] = graph.insertVertex(parent, null, getPoolName(crontab), 0, this.yPool, 640, 0, mxConstants.SHAPE_SWIMLANE)
                        this.instances[getPoolName(crontab)].setConnectable(false);
                        this.xCrontab[getPoolName(crontab)] = 10 + space;
                        this.yPool += h + space;
                    }
                    return this.instances[getPoolName(crontab)];
                },
                getNextXinPool: function (crontab) {
                    let x = this.xCrontab[getPoolName(crontab)];
                    this.xCrontab[getPoolName(crontab)] += w + space;
                    return x + space;
                }
            };
            crontabs.forEach(function(crontab) {
                pools.vertex[crontab._id] = graph.insertVertex(pools.getPool(crontab), crontab._id, crontab.name, pools.getNextXinPool(crontab), 0, w, h);
            });
            crontabs.forEach(function(sourceJob) {

                if ("trigger" in sourceJob) {
                    sourceJob.trigger.forEach(function(targetJobId) {
                        graph.insertEdge(parent, null, '', pools.vertex[sourceJob._id], pools.vertex[targetJobId]);
                    });
                }
            });


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

function getPoolName(crontab)
{
    if ("remote" in crontab) {
        if ("ssh" in crontab.remote && crontab.remote.ssh.enabled=="on") {
            var name = crontab.remote.ssh.server;
            if (/@/.test(name)) {
                name = crontab.remote.ssh.server.split("@")[1];
            }
            return name.substring(0,15);
        }
        if ("docker" in crontab.remote && crontab.remote.docker.enabled=="on") {
            return crontab.remote.docker.image.substring(0,15);
        }
    }
    return "local";
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
}

function putEvent(graph)
{

    graph.addListener(mxEvent.DOUBLE_CLICK, function(sender, evt)
    {
        var me = evt.getProperty('event');
        var cell = evt.getProperty('cell');


        if (cell != null)
        {
            crontabs.forEach(function(crontab) {
                if (cell.id == crontab._id) {
                    editJob(crontab._id);
                    evt.consume();
                    return;
                }
            });
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
                        editJob(crontab._id);
                        return;
                    }
                });
            });
        }

    });

}