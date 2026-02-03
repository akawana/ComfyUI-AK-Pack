import json
import zlib
import comfy.samplers


class AKKSamplerSettings:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # Don't name this input exactly "seed" or ComfyUI may auto-randomize it
                # depending on global seed behavior, causing this node to look "changed" every run.
                "seed_value": ("INT", {"default": 0, "min": 0, "max": 2147483647, "step": 1}),
                "steps": ("INT", {"default": 20, "min": 1, "max": 10000, "step": 1}),
                "cfg": ("FLOAT", {"default": 7.0, "min": 0.0, "max": 100.0, "step": 0.1}),
                "sampler_name": (comfy.samplers.SAMPLER_NAMES, {"default": comfy.samplers.SAMPLER_NAMES[0]}),
                "scheduler": (comfy.samplers.SCHEDULER_NAMES, {"default": comfy.samplers.SCHEDULER_NAMES[0]}),
                "denoise": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "xz_steps": ("INT", {"default": 1, "min": 1, "max": 9999, "step": 1}),
            },
            "hidden": {
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("sampler_settings",)
    FUNCTION = "run"
    CATEGORY = "AK/sampling"

    def run(
        self,
        seed_value: int,
        steps: int,
        cfg: float,
        sampler_name: str,
        scheduler: str,
        denoise: float,
        xz_steps: int,
        node_id=None,
    ):
        from_id = str(node_id) if node_id is not None else ""
        seed = int(seed_value)
        if seed < 0:
            seed = 0

        data = {
            "seed": seed,
            "steps": int(steps),
            "cfg": float(cfg),
            "sampler_name": str(sampler_name),
            "scheduler": str(scheduler),
            "denoise": float(denoise),
            "xz_steps": int(xz_steps),
            "from_id": from_id,
        }

        payload = (
            f"{data['seed']}|{data['steps']}|{data['cfg']}|{data['sampler_name']}|"
            f"{data['scheduler']}|{data['denoise']}|{data['xz_steps']}|{from_id}"
        )
        h = zlib.adler32(payload.encode("utf-8")) & 0xFFFFFFFF
        data["hash"] = int(h)

        s = json.dumps(data, ensure_ascii=False)
        return (s,)


class AKKSamplerSettingsOut:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "sampler_settings": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = (
        "INT",
        "INT",
        "FLOAT",
        comfy.samplers.SAMPLER_NAMES,
        comfy.samplers.SCHEDULER_NAMES,
        "FLOAT",
        "INT",
    )
    RETURN_NAMES = (
        "seed",
        "steps",
        "cfg",
        "sampler_name",
        "scheduler",
        "denoise",
        "xz_steps",
    )
    FUNCTION = "run"
    CATEGORY = "AK/sampling"

    def run(self, sampler_settings: str):
        data = {}
        if isinstance(sampler_settings, str) and sampler_settings.strip():
            try:
                data = json.loads(sampler_settings)
                if not isinstance(data, dict):
                    data = {}
            except Exception:
                data = {}

        seed = int(data.get("seed", 0) or 0)
        if seed < 0:
            seed = 0

        steps = int(data.get("steps", 20) or 20)

        try:
            cfg = float(data.get("cfg", 7.0))
        except Exception:
            cfg = 7.0

        sampler_name = str(data.get("sampler_name", comfy.samplers.SAMPLER_NAMES[0]))
        if sampler_name not in comfy.samplers.SAMPLER_NAMES:
            sampler_name = comfy.samplers.SAMPLER_NAMES[0]

        scheduler = str(data.get("scheduler", comfy.samplers.SCHEDULER_NAMES[0]))
        if scheduler not in comfy.samplers.SCHEDULER_NAMES:
            scheduler = comfy.samplers.SCHEDULER_NAMES[0]

        try:
            denoise = float(data.get("denoise", 1.0))
        except Exception:
            denoise = 1.0

        xz_steps_raw = data.get("xz_steps", 1)
        try:
            xz_steps = int(xz_steps_raw)
        except Exception:
            xz_steps = 1
        if xz_steps < 1:
            xz_steps = 1

        return (seed, steps, cfg, sampler_name, scheduler, denoise, xz_steps)


NODE_CLASS_MAPPINGS = {
    "AKKSamplerSettings": AKKSamplerSettings,
    "AKKSamplerSettingsOut": AKKSamplerSettingsOut,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKKSamplerSettings": "AK KSampler Settings",
    "AKKSamplerSettingsOut": "AK KSampler Settings Out",
}
