import json
import comfy.samplers


class AKBaseSettingsOut:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ak_base_settings": ("STRING", {"forceInput": True}),
            }
        }

    # RETURN_TYPES = ("STRING", "INT", "INT", comfy.samplers.SAMPLER_NAMES, comfy.samplers.SCHEDULER_NAMES, "INT", "FLOAT", "FLOAT", "INT")
    RETURN_TYPES = ("STRING", "INT", "INT", comfy.samplers.SAMPLER_NAMES, comfy.samplers.SCHEDULER_NAMES, "INT", "FLOAT", "FLOAT", "INT")
    RETURN_NAMES = (
        "output_folder",
        "width",
        "heigth",
        "sampler_name",
        "scheduler",
        "seed",
        "cfg",
        "denoise",
        "xy_variations",
    )
    FUNCTION = "run"
    CATEGORY = "AK/_testing_"

    def run(self, ak_base_settings: str):
        data = {}
        try:
            if ak_base_settings is not None:
                s = str(ak_base_settings).strip()
                if s:
                    data = json.loads(s)
        except Exception:
            data = {}

        output_folder = str(data.get("output_folder", ""))
        width = int(data.get("width", 0) or 0)
        heigth = int(data.get("height", data.get("heigth", 0)) or 0)
        # sampler_name = [str(data.get("sampler_name", "euler"))]
        # scheduler = [str(data.get("scheduler", "normal"))]
        sampler_name = comfy.samplers.SAMPLER_NAMES.insert(0, str(data.get("sampler_name", "euler")))
        scheduler = comfy.samplers.SCHEDULER_NAMES.insert(0, str(data.get("scheduler", "normal")))
        seed = int(data.get("seed", 0) or 0)
        cfg = float(data.get("cfg", 0.0) or 0.0)
        denoise = float(data.get("denoise", 0.0) or 0.0)
        xy_variations = int(data.get("xy_variations", 0) or 0)

        return (output_folder, width, heigth, sampler_name, scheduler, seed, cfg, denoise, xy_variations)


NODE_CLASS_MAPPINGS = {
    "AK Base Settings Out": AKBaseSettingsOut,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Base Settings Out": "AK Base Settings Out",
}
