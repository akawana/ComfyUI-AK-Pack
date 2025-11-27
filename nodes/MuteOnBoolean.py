class MuteOnBoolean:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "active": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = ()
    RETURN_NAMES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "utils/logic"

    @classmethod
    def IS_CHANGED(cls, state):
        return float("nan")

    def do_nothing(self, state):
        return ()


NODE_CLASS_MAPPINGS = {
    "MuteOnBoolean": MuteOnBoolean,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MuteOnBoolean": "MuteOnBoolean",
}
