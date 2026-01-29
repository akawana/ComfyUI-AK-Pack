
// AddSpacer.js

import { app } from "../../../scripts/app.js";


const TARGET_NODES = [
    "AK Control Multiple KSamplers",
];

function addSpacerWidget(nodeName, beforeWidgetName, seze=20) {
    app.registerExtension({
        name: `AK.AddSpacer.${nodeName}.${beforeWidgetName}`,
        nodeCreated(node) {
            if (node.comfyClass !== nodeName) return;

            const insertSpacer = () => {
                if (node.__ak_spacer_added) return;
                node.__ak_spacer_added = true;

                const spacer = node.addWidget("custom", "", "", () => { });
                spacer.serialize = false;
                spacer.computeSize = () => [1, seze];

                const widgets = node.widgets || [];
                const targetIndex = widgets.findIndex(w => w.name === beforeWidgetName);

                widgets.splice(widgets.indexOf(spacer), 1);

                if (targetIndex !== -1) {
                    widgets.splice(targetIndex, 0, spacer);
                } else {
                    widgets.push(spacer);
                }
            };

            const origOnConfigure = node.onConfigure;
            node.onConfigure = function () {
                if (origOnConfigure) origOnConfigure.apply(this, arguments);
                insertSpacer();
            };

            queueMicrotask(insertSpacer);
        },
    });
}

// examples
addSpacerWidget("AK Control Multiple KSamplers", "choose_ksampler", 10);
addSpacerWidget("AK Control Multiple KSamplers", "seed ", 10);
