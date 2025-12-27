# IsMaskEmpty.py
# ComfyUI custom node: Is Mask Empty

import torch

class IsMaskEmpty:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "mask": ("MASK",),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("is_empty",)
    FUNCTION = "check"
    CATEGORY = "AK/mask"

    def check(self, mask=None):
        # Default: mask is considered empty
        if mask is None:
            return (True,)

        # Ensure tensor
        if not isinstance(mask, torch.Tensor):
            return (True,)

        # Check for any non-zero pixel
        # MASK in ComfyUI is usually float tensor in range [0,1]
        if torch.any(mask != 0):
            return (False,)

        return (True,)


NODE_CLASS_MAPPINGS = {
    "IsMaskEmpty": IsMaskEmpty
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "IsMaskEmpty": "Is Mask Empty"
}
