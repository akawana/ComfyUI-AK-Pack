from comfy_api.latest import ComfyExtension, io


class AKIsOneOfGroupsActive(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="AKIsOneOfGroupsActive",
            display_name="AKIsOneOfGroupsActive",
            category="AK/logic",
            inputs=[
                io.String.Input(
                    "group_name_contains",
                    default="",
                    multiline=False,
                ),
                io.Boolean.Input(
                    "active_state",
                    default=False,
                ),
            ],
            outputs=[
                io.Boolean.Output(display_name="boolean"),
            ],
        )

    @classmethod
    def fingerprint_inputs(cls, group_name_contains, active_state):
        return float("nan")

    @classmethod
    def execute(cls, group_name_contains, active_state) -> io.NodeOutput:
        return io.NodeOutput(bool(active_state))


class AKIfElseIsOneOfGroupsActive(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="AKIfElseIsOneOfGroupsActive",
            display_name="AKIfElseIsOneOfGroupsActive",
            category="AK/logic",
            inputs=[
                io.String.Input(
                    "group_name_contains",
                    default="",
                    multiline=False,
                ),
                io.Boolean.Input(
                    "active_state",
                    default=False,
                ),
                io.Custom("*").Input("on_true",  optional=True),
                io.Custom("*").Input("on_false", optional=True),
            ],
            outputs=[
                io.Custom("*").Output(display_name="out"),
            ],
        )

    @classmethod
    def fingerprint_inputs(cls, **kwargs):
        return float("nan")

    @classmethod
    def execute(cls, group_name_contains, active_state, on_true=None, on_false=None) -> io.NodeOutput:
        return io.NodeOutput(on_true if bool(active_state) else on_false)


class AKIsOneOfGroupsActiveExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [AKIsOneOfGroupsActive, AKIfElseIsOneOfGroupsActive]


async def comfy_entrypoint() -> AKIsOneOfGroupsActiveExtension:
    return AKIsOneOfGroupsActiveExtension()


NODE_CLASS_MAPPINGS = {
    "AKIsOneOfGroupsActive":        AKIsOneOfGroupsActive,
    "AKIfElseIsOneOfGroupsActive":  AKIfElseIsOneOfGroupsActive,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKIsOneOfGroupsActive":        "AKIsOneOfGroupsActive",
    "AKIfElseIsOneOfGroupsActive":  "AKIfElseIsOneOfGroupsActive",
}
