from comfy_api.latest import ComfyExtension, io


class AKProjectSettingsOutResize(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="AKProjectSettingsOutResize",
            display_name="AK Project Settings Out Resize",
            category="AK/settings",
            description=(
                "Outputs resize-related values from the Project Settings panel: "
                "width, height, and do_resize flag."
            ),
            inputs=[
                io.String.Input(
                    "ak_project_settings_json",
                    default="",
                    multiline=False,
                    tooltip="JSON string from the AK Project Settings panel.",
                    advanced=True, 
                ),
            ],
            outputs=[
                io.Int.Output(display_name="width"),
                io.Int.Output(display_name="height"),
                io.Boolean.Output(display_name="do_resize"),
            ],
        )

    @classmethod
    def execute(cls, ak_project_settings_json: str) -> io.NodeOutput:
        import json

        try:
            vals = json.loads(ak_project_settings_json or "{}")
        except Exception:
            vals = {}

        width = int(vals.get("width", 0) or 0)
        height = int(vals.get("height", 0) or 0)
        do_resize = bool(int(vals.get("do_resize", 0) or 0) == 1)

        return io.NodeOutput(width, height, do_resize)


class AKProjectSettingsOutResizeExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [AKProjectSettingsOutResize]


async def comfy_entrypoint() -> AKProjectSettingsOutResizeExtension:
    return AKProjectSettingsOutResizeExtension()


NODE_CLASS_MAPPINGS = {
    "AKProjectSettingsOutResize": AKProjectSettingsOutResize,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKProjectSettingsOutResize": "AK Project Settings Out Resize",
}
