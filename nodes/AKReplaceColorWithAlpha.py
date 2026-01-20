import torch
import re

class AKReplaceColorWithAlpha:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "color_rgb": ("STRING", {"default": "8, 39, 245", "multiline": False}),
                "threshold": ("INT", {"default": 0, "min": 0, "max": 255, "step": 1}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "replace_color"
    CATEGORY = "AK/Images"

    @staticmethod
    def _parse_rgb(s: str):
        parts = [p for p in re.split(r"[,\s;]+", (s or "").strip()) if p != ""]
        if len(parts) != 3:
            return (8, 39, 245)
        vals = []
        for p in parts:
            try:
                v = int(float(p))
            except Exception:
                return (8, 39, 245)
            vals.append(max(0, min(255, v)))
        return tuple(vals)

    def replace_color(self, image, color_rgb, threshold):
        # ComfyUI IMAGE is typically [B, H, W, C] in 0..1
        if image.dim() != 4:
            return (image,)

        rgb = self._parse_rgb(color_rgb)
        target = torch.tensor([rgb[0], rgb[1], rgb[2]], device=image.device, dtype=image.dtype) / 255.0

        c = image.shape[-1]
        if c < 3:
            return (image,)

        src_rgb = image[..., :3].clamp(0.0, 1.0)

        if c >= 4:
            src_a = image[..., 3:4].clamp(0.0, 1.0)
        else:
            src_a = torch.ones_like(image[..., :1])

        thr = int(threshold) if threshold is not None else 0
        if thr < 0:
            thr = 0
        elif thr > 255:
            thr = 255

        if thr <= 0:
            # Exact match with minimal epsilon for float rounding.
            eps = (1.0 / 255.0) + 1e-6
            diff = (src_rgb - target.view(1, 1, 1, 3)).abs()
            sel = (diff <= eps).all(dim=-1, keepdim=True)
        else:
            # Euclidean distance in RGB (0..1). Threshold is given in 0..255 space.
            t = float(thr) / 255.0
            d2 = (src_rgb - target.view(1, 1, 1, 3)).pow(2).sum(dim=-1, keepdim=True)
            sel = d2 <= (t * t + 1e-12)

        out_a = torch.where(sel, torch.zeros_like(src_a), src_a)
        out = torch.cat([src_rgb, out_a], dim=-1)
        return (out,)


NODE_CLASS_MAPPINGS = {
    "AK Replace Color with Alpha": AKReplaceColorWithAlpha,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Replace Color with Alpha": "AK Replace Color with Alpha",
}
