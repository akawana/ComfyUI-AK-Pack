class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

ANY_TYPE = AnyType("*")


class Setter:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "obj": ("*",),
                "var_name": ("STRING", {"default": ""}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("OUT",)
    FUNCTION = "set"
    # OUTPUT_NODE = True
    CATEGORY = "AK/pipe"

    def set(self, obj, var_name="", unique_id=None):
        name = ""
        if isinstance(var_name, str):
            name = var_name.strip()
        else:
            try:
                name = str(var_name).strip()
            except Exception:
                name = ""

        if not name:
            raise Exception(f"[Setter {unique_id}] var_name is empty")

        return (obj,)


NODE_CLASS_MAPPINGS = {
    "Setter": Setter,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "Setter": "Setter",
}
