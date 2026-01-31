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
                "inp": (ANY_TYPE,),
            },
            "hidden": {
                "var_name": "STRING",
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = (ANY_TYPE,)
    RETURN_NAMES = ("OBJ",)
    FUNCTION = "get"
    CATEGORY = "AK/pipe"

    def get(self, inp=None, var_name="", unique_id=None):
        if inp is None:
            raise Exception(f"[Getter {unique_id} {var_name}] inp is not connected")
        return (inp,)


NODE_CLASS_MAPPINGS = {
    "Getter": Getter,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "Getter": "Getter",
}
