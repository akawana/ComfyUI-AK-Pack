
import json
import comfy.samplers


class AKSettingsOut:
    _STATE_BY_UID = {}

    @classmethod
    def INPUT_TYPES(s):
        required = {
            "ak_settings_0": ("STRING", {"forceInput": True}),
        }
        optional = {}
        for i in range(1, 10):
            optional[f"ak_settings_{i}"] = ("STRING", {"forceInput": True})
        return {
            "required": required,
            "optional": optional,
            "hidden": {"unique_id": "UNIQUE_ID"},
            }
    RETURN_TYPES = (
        "STRING",
        "INT",
        "INT",
        "BOOLEAN",
        comfy.samplers.SAMPLER_NAMES,
        comfy.samplers.SCHEDULER_NAMES,
        "INT",
        "FLOAT",
        "FLOAT",
        "INT",
    )
    RETURN_NAMES = (
        "output_folder",
        "width",
        "height",
        "do_resize",
        "sampler_name",
        "scheduler",
        "seed",
        "cfg",
        "denoise",
        "xz_steps",
    )
    FUNCTION = "output_settings"
    CATEGORY = "AK/settings"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        uid = kwargs.get("unique_id", None)
        key = str(uid) if uid is not None else "global"

        prev_state = cls._STATE_BY_UID.get(key, None)
        prev_hashes = prev_state.get("hashes", [None] * 10) if isinstance(prev_state, dict) else [None] * 10

        inputs = []
        for i in range(10):
            inputs.append(kwargs.get(f"ak_settings_{i}", None))

        changed_idx = None
        last_not_none_hash = None
        curr_hashes = [None] * 10

        for idx, s in enumerate(inputs):
            if s is None or not isinstance(s, str) or not s.strip():
                continue
            try:
                data = json.loads(s)
            except Exception:
                continue
            h = data.get("hash", None)
            if h is None:
                continue
            curr_hashes[idx] = h
            last_not_none_hash = h

            prev = prev_hashes[idx] if idx < len(prev_hashes) else None
            if prev != h and changed_idx is None:
                changed_idx = idx

        selected_hash = None
        if changed_idx is not None:
            selected_hash = curr_hashes[changed_idx]
        elif last_not_none_hash is not None:
            selected_hash = last_not_none_hash
        else:
            selected_hash = ""

        return str(selected_hash)
    def __init__(self):
        default_sampler = comfy.samplers.SAMPLER_NAMES[0] if comfy.samplers.SAMPLER_NAMES else ""
        default_scheduler = comfy.samplers.SCHEDULER_NAMES[0] if comfy.samplers.SCHEDULER_NAMES else ""
        self._hashes = [None] * 10
        self._last_values = (
            "",
            0,
            0,
            True,
            default_sampler,
            default_scheduler,
            0,
            0.0,
            0.0,
            1,
        )

    def _extract_values(self, data):
        output_folder = str(data.get("output_folder", ""))

        width = int(data.get("width", 0) or 0)
        height = int(data.get("height", data.get("heigth", 0)) or 0)

        do_resize = bool(data.get("do_resize", True))

        sampler_default = comfy.samplers.SAMPLER_NAMES[0] if comfy.samplers.SAMPLER_NAMES else ""
        scheduler_default = comfy.samplers.SCHEDULER_NAMES[0] if comfy.samplers.SCHEDULER_NAMES else ""

        sampler_name_str = str(data.get("sampler_name", sampler_default))
        scheduler_str = str(data.get("scheduler", scheduler_default))

        if sampler_name_str not in comfy.samplers.SAMPLER_NAMES:
            sampler_name_str = sampler_default
        if scheduler_str not in comfy.samplers.SCHEDULER_NAMES:
            scheduler_str = scheduler_default

        seed = int(data.get("seed", 0))
        cfg = float(data.get("cfg", 0.0))
        denoise = float(data.get("denoise", 0.0))
        xy = int(data.get("xz_steps", 1))

        return (
            output_folder,
            width,
            height,
            do_resize,
            sampler_name_str,
            scheduler_str,
            seed,
            cfg,
            denoise,
            xy,
        )

    def output_settings(
        self,
        ak_settings_0,
        ak_settings_1=None,
        ak_settings_2=None,
        ak_settings_3=None,
        ak_settings_4=None,
        ak_settings_5=None,
        ak_settings_6=None,
        ak_settings_7=None,
        ak_settings_8=None,
        ak_settings_9=None,
        unique_id=None
    ):
        inputs = [
            ak_settings_0,
            ak_settings_1,
            ak_settings_2,
            ak_settings_3,
            ak_settings_4,
            ak_settings_5,
            ak_settings_6,
            ak_settings_7,
            ak_settings_8,
            ak_settings_9,
        ]

        changed_idx = None
        changed_values = None
        last_not_none_values = None
        last_not_none_idx = None

        for idx, s in enumerate(inputs):
            if s is None:
                continue
            if not isinstance(s, str):
                continue
            if not s.strip():
                continue

            try:
                data = json.loads(s)
            except Exception:
                continue

            h = data.get("hash", None)
            if h is None:
                continue

            values = self._extract_values(data)
            last_not_none_values = values
            last_not_none_idx = idx

            prev = self._hashes[idx]
            if prev != h and changed_idx is None:
                changed_idx = idx
                changed_values = values

            self._hashes[idx] = h

        if changed_idx is not None and changed_values is not None:
            self._last_values = changed_values
        elif last_not_none_values is not None:
            self._last_values = last_not_none_values

        try:

            uid_key = str(unique_id) if unique_id is not None else "global"

            selected_hash = None

            if changed_idx is not None and changed_idx < len(self._hashes):

                selected_hash = self._hashes[changed_idx]

            elif last_not_none_idx is not None and last_not_none_idx < len(self._hashes):

                selected_hash = self._hashes[last_not_none_idx]

            self.__class__._STATE_BY_UID[uid_key] = {

                "hashes": list(self._hashes),

                "last_selected_hash": str(selected_hash) if selected_hash is not None else "",

            }

        except Exception:

            pass


        return self._last_values
NODE_CLASS_MAPPINGS = {
    "AKSettingsOut": AKSettingsOut
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKSettingsOut": "AK Settings Out"
}
