# nodes/IndexMultiple.py

class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

ANY_TYPE = AnyType("*")

class IndexMultiple:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_any": (ANY_TYPE, {"forceInput": False}),
                "starting_index": ("INT", {"default": 0, "min": 0, "step": 1}),
                "length": ("INT", {"default": 1, "min": 1, "max": 50, "step": 1}),
            },
            "optional": {
                "if_none": (ANY_TYPE, {}),
            }
        }

    RETURN_TYPES = (ANY_TYPE,) * 50
    RETURN_NAMES = tuple(f"item_{i}" for i in range(50))

    FUNCTION = "execute"
    CATEGORY = "AK/utils/list"
    OUTPUT_NODE = False

    INPUT_IS_LIST = True

    def execute(self, input_any, starting_index, length, if_none=None):
        if isinstance(input_any, (list, tuple)):
            if len(input_any) == 1 and isinstance(input_any[0], (list, tuple)):
                items = list(input_any[0])
            else:
                items = list(input_any)
        else:
            items = [input_any]

        start = max(0, int(starting_index[0] if isinstance(starting_index, (list, tuple)) else starting_index))
        length_val = max(1, min(50, int(length[0] if isinstance(length, (list, tuple)) else length)))

#        for i, v in enumerate(items[:10]):
#            print(f"  [{i}] {v}")

        if isinstance(if_none, (list, tuple)):
            fallback = if_none[0] if len(if_none) > 0 else None
        else:
            fallback = if_none

        # print(fallback)
        result = []

        for i in range(50):
            idx = start + i

            if i < length_val and 0 <= idx < len(items):
                v = items[idx]
                if v is None and fallback is not None:
                    v = fallback
            else:
                v = fallback

            result.append(v)


        return tuple(result)


NODE_CLASS_MAPPINGS = {"IndexMultiple": IndexMultiple}
NODE_DISPLAY_NAME_MAPPINGS = {"IndexMultiple": "Index Multiple"}
