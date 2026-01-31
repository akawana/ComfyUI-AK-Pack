import comfy.samplers

class AKControlMultipleKSamplers:
    """
    UI-only control node (no outputs). Frontend JS drives synchronization.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "choose_ksampler": (["<none>"], {"default": "<none>"}),

                "seed ": ("INT", {"default": 0, "min": 0, "max": 0x7FFFFFFF, "step": 1}),
                "steps": ("INT", {"default": 15, "min": 1, "max": 100, "step": 1}),
                "cfg": ("FLOAT", {"default": 8.0, "min": 0.0, "max": 100.0, "step": 0.1}),
                "sampler_name": (
                    comfy.samplers.SAMPLER_NAMES,
                    {"default": comfy.samplers.SAMPLER_NAMES[0]}
                ),
                "scheduler": (
                    comfy.samplers.SCHEDULER_NAMES,
                    {"default": comfy.samplers.SCHEDULER_NAMES[0]}
                ),
                "denoise": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
            },
            "hidden": {
                "_ak_state_json": ("STRING", {"default": "{}", "multiline": True}),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "noop"
    CATEGORY = "AK/settings"

    def noop(self, **kwargs):
        return ()


NODE_CLASS_MAPPINGS = {
    "AK Control Multiple KSamplers": AKControlMultipleKSamplers
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Control Multiple KSamplers": "AK Control Multiple KSamplers"
}
