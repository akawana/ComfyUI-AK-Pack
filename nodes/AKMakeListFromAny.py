class AKMakeListFromAny:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "inp": ("*", {"forceInput": True}),
                "length": ("INT", {"default": 1, "min": 1, "step": 1}),
            }
        }

    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("out_list",)
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "run"
    CATEGORY = "AK/utils"

    def run(self, inp=None, length=1):
        try:
            length = int(length)
        except Exception:
            length = 1

        if length < 1:
            length = 1

        out = [inp for _ in range(length)]
        return (out,)


NODE_CLASS_MAPPINGS = {
    "AK Make List From Any": AKMakeListFromAny
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Make List From Any": "AK Make List From Any"
}
