class RepeatGroupState:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "group_name_contains": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": False,
                    },
                ),
            }
        }

    RETURN_TYPES = ()
    RETURN_NAMES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "utils/logic"

    @classmethod
    def IS_CHANGED(cls, group_name_contains):
        return float("nan")

    def do_nothing(self, group_name_contains):
        return ()


NODE_CLASS_MAPPINGS = {
    "RepeatGroupState": RepeatGroupState,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RepeatGroupState": "RepeatGroupState",
}
