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

        // Enables rubberband selection
        new mxRubberband(graph);

        // Gets the default parent for inserting new cells. This
        // is normally the first child of the root (ie. layer 0).
        var parent = graph.getDefaultParent();

        // Adds cells to the model in a single step
        graph.getModel().beginUpdate();
        try
        {
            var x = 0;
            var y = 0;
            var w = 80;
            var h = 30;
            var space = 20;
            crontabs.forEach(function(crontab) {
                var v1 = graph.insertVertex(parent, null, crontab.name, x, y, w, h);
                x += w + space;
            });

            //var e1 = graph.insertEdge(parent, null, '', v1, v2);
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