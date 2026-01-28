
import json
import zlib
import comfy.samplers


class AKSettingsBig:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "output_folder": ("STRING", {"default": ""}),
                "width": ("INT", {"default": 512, "min": 1, "max": 8192, "step": 1}),
                "height": ("INT", {"default": 512, "min": 1, "max": 8192, "step": 1}),
                "do_resize": ("BOOLEAN", {"default": True}),
                "sampler_name": (comfy.samplers.SAMPLER_NAMES, {"default": comfy.samplers.SAMPLER_NAMES[0]}),
                "scheduler": (comfy.samplers.SCHEDULER_NAMES, {"default": comfy.samplers.SCHEDULER_NAMES[0]}),
                "seed": ("INT", {"default": 0, "min": -2147483648, "max": 2147483647, "step": 1}),
                "cfg": ("FLOAT", {"default": 7.0, "min": 0.0, "max": 100.0, "step": 0.1}),
                "denoise": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "xz_steps": ("INT", {"default": 1, "min": 1, "max": 9999, "step": 1}),
            },
            "hidden": {
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("ak_settings",)
    FUNCTION = "run"
    CATEGORY = "AK/settings"

    def run(
        self,
        output_folder: str,
        width: int,
        height: int,
        do_resize: bool,
        sampler_name: str,
        scheduler: str,
        seed: int,
        cfg: float,
        denoise: float,
        xz_steps: int,
        node_id=None,
    ):
        from_id = str(node_id) if node_id is not None else ""
        data = {
            "output_folder": str(output_folder),
            "width": int(width),
            "height": int(height),
            "do_resize": bool(do_resize),
            "sampler_name": str(sampler_name),
            "scheduler": str(scheduler),
            "seed": int(seed),
            "cfg": float(cfg),
            "denoise": float(denoise),
            "xz_steps": int(xz_steps),
            "from_id": from_id,
        }

        payload = (
            f"{data['output_folder']}|{data['width']}|{data['height']}|{int(data['do_resize'])}|"
            f"{data['sampler_name']}|{data['scheduler']}|{data['seed']}|{data['cfg']}|"
            f"{data['denoise']}|{data['xz_steps']}|{from_id}"
        )
        h = zlib.adler32(payload.encode("utf-8")) & 0xFFFFFFFF
        data["hash"] = int(h)

        s = json.dumps(data, ensure_ascii=False)
        return (s,)


NODE_CLASS_MAPPINGS = {
    "AKSettingsBig": AKSettingsBig,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKSettingsBig": "AK Settings Big",
}
