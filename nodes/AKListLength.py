class AKListLength:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "inp": ("*", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("length",)
    FUNCTION = "run"
    CATEGORY = "AK/utils"

    INPUT_IS_LIST = (True,)

    def run(self, inp=None):
        if isinstance(inp, list):
            return (len(inp),)
        return (0,)


NODE_CLASS_MAPPINGS = {
    "AK List Length": AKListLength
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK List Length": "AK List Length"
}
