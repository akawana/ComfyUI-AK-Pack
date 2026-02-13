class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

ANY_TYPE = AnyType("*")


class Getter:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "inp": ("*",),
            },
            "hidden": {
                "var_name": "STRING",
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("OBJ",)
    FUNCTION = "get"
    CATEGORY = "AK/pipe"

    def get(self, inp=None, var_name="", unique_id=None):
        if inp is None:
            return (None,)
        return (inp,)


NODE_CLASS_MAPPINGS = {
    "Getter": Getter,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "Getter": "Getter",
}
