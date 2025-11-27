class BypassOnBoolean:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "state": ("BOOLEAN", {"default": True}),
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
    "BypassOnBoolean": BypassOnBoolean,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BypassOnBoolean": "BypassOnBoolean",
}
