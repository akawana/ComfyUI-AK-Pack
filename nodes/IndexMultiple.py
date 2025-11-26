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
                "input_any": (ANY_TYPE, {"forceInput": True}),
                "starting_index": ("INT", {"default": 0, "min": 0, "step": 1}),
                "length": ("INT", {"default": 1, "min": 1, "max": 50, "step": 1}),
            },
        }

    RETURN_TYPES = (ANY_TYPE,) * 50
    RETURN_NAMES = tuple(f"item_{i}" for i in range(50))

    FUNCTION = "execute"
    CATEGORY = "utils/list"
    OUTPUT_NODE = True

    INPUT_IS_LIST = True

    def execute(self, input_any, starting_index, length):
        if isinstance(input_any, (list, tuple)):
            if len(input_any) == 1 and isinstance(input_any[0], (list, tuple)):
                items = list(input_any[0])
            else:
                items = list(input_any)
        else:
            items = [input_any]

        start = max(0, int(starting_index[0] if isinstance(starting_index, (list, tuple)) else starting_index))
        length_val = max(1, min(50, int(length[0] if isinstance(length, (list, tuple)) else length)))

        for i, v in enumerate(items[:10]):
            print(f"  [{i}] {v}")

        result = []
        for i in range(50):
            idx = start + i
            if i < length_val and idx < len(items):
                result.append(items[idx])
            else:
                result.append(None)

        return tuple(result)


NODE_CLASS_MAPPINGS = {"IndexMultiple": IndexMultiple}
NODE_DISPLAY_NAME_MAPPINGS = {"Index Multiple": "Index Multiple"}
#__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']