
import comfy.utils
import nodes
import math
import json
import zlib


class AKSettingsMini:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "seed": ("INT", {
                    "default": 0,
                    "min": 0,
                    "max": 2**32 - 1,
                    "step": 1,
                }),
                "cfg": ("FLOAT", {
                    "default": 1.0,
                    "min": 0.5,
                    "max": 10.0,
                    "step": 0.5,
                    "round": 0.1,
                }),
                "denoise": ("FLOAT", {
                    "default": 0.5,
                    "min": 0.05,
                    "max": 1.0,
                    "step": 0.05,
                    "round": 0.01,
                }),
                "xz_steps": ("INT", {
                    "default": 1,
                    "min": 1,
                    "max": 9999,
                    "step": 1,
                }),
            },
            "hidden": {
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("ak_settings",)
    FUNCTION = "make_settings"
    CATEGORY = "AK/settings"

    def make_settings(self, seed, cfg, denoise, xz_steps, node_id=None):
        cfg = round(cfg, 1)
        denoise = round(denoise, 2)

        from_id = str(node_id) if node_id is not None else ""

        payload = f"{from_id}|{int(seed)}|{float(cfg)}|{float(denoise)}|{int(xz_steps)}"
        h = zlib.adler32(payload.encode("utf-8")) & 0xFFFFFFFF

        s = json.dumps(
            {
                "seed": int(seed),
                "cfg": float(cfg),
                "denoise": float(denoise),
                "xz_steps": int(xz_steps),
                "from_id": from_id,
                "hash": int(h),
            },
            ensure_ascii=False,
        )

        return (s,)


NODE_CLASS_MAPPINGS = {
    "AKSettingsMini": AKSettingsMini,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKSettingsMini": "AK Settings Mini"
}
