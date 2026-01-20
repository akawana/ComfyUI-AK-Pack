import { app } from "/scripts/app.js";

function addSpacer(node, afterName) {
  if (!node?.widgets) return;

  const idx = node.widgets.findIndex(w => w?.name === afterName);
  const insertAt = (idx >= 0) ? (idx + 1) : node.widgets.length;

  const spacer = node.addWidget("null", "", null, null, () => {});
  spacer.name = `__spacer__${Math.random().toString(36).slice(2)}`;

  node.widgets.splice(insertAt, 0, node.widgets.pop());
  node.setSize?.(node.size);
}

app.registerExtension({
  name: "AKSettingsBig.Spacers",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== "AK Settings Big") return;

    const onCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onCreated?.apply(this, arguments);
      addSpacer(this, "do_resize");
      addSpacer(this, "scheduler");
      addSpacer(this, "denoise");
      return r;
    };
  },
});
