import torch
import re

class AKReplaceColorWithAlpha:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "color_pick_mode": (["user_color", "left_top_pixel", "right_top_pixel", "left_bottom_pixel", "right_bottom_pixel"], {"default": "user_color"}),
                "color_rgb": ("STRING", {"default": "8, 39, 245", "multiline": False}),
                "threshold": ("INT", {"default": 0, "min": 0, "max": 255, "step": 1}),
                "softness": ("INT", {"default": 0, "min": 0, "max": 255, "step": 1}),
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

    @staticmethod
    def _pick_corner_color(src_rgb: torch.Tensor, mode: str):
        # src_rgb: [B, H, W, 3] in 0..1
        _, h, w, _ = src_rgb.shape
        if mode == "left_top_pixel":
            y, x = 0, 0
        elif mode == "right_top_pixel":
            y, x = 0, max(0, w - 1)
        elif mode == "left_bottom_pixel":
            y, x = max(0, h - 1), 0
        elif mode == "right_bottom_pixel":
            y, x = max(0, h - 1), max(0, w - 1)
        else:
            y, x = 0, 0
        # Take the first batch element's corner pixel as the target color
        return src_rgb[0, y, x, :].clamp(0.0, 1.0)

    def replace_color(self, image, color_pick_mode, color_rgb, threshold, softness):
        if image.dim() != 4:
            return (image,)

        c = image.shape[-1]
        if c < 3:
            return (image,)

        src_rgb = image[..., :3].clamp(0.0, 1.0)

        if c >= 4:
            src_a = image[..., 3:4].clamp(0.0, 1.0)
        else:
            src_a = torch.ones_like(image[..., :1])

        mode = str(color_pick_mode or "user_color")

        if mode == "user_color":
            rgb = self._parse_rgb(color_rgb)
            target = torch.tensor([rgb[0], rgb[1], rgb[2]], device=image.device, dtype=image.dtype) / 255.0
        else:
            target = self._pick_corner_color(src_rgb, mode).to(device=image.device, dtype=image.dtype)

        thr = int(threshold) if threshold is not None else 0
        soft = int(softness) if softness is not None else 0
        if thr < 0:
            thr = 0
        elif thr > 255:
            thr = 255
        if soft < 0:
            soft = 0
        elif soft > 255:
            soft = 255

        t0 = float(thr) / 255.0
        t1 = float(min(255, thr + soft)) / 255.0

        d2 = (src_rgb - target.view(1, 1, 1, 3)).pow(2).sum(dim=-1, keepdim=True)

        if soft <= 0:
            sel = d2 <= (t0 * t0 + 1e-12)
            out_a = torch.where(sel, torch.zeros_like(src_a), src_a)
        else:
            d = torch.sqrt(d2 + 1e-12)
            denom = t1 - t0
            if denom <= 1e-8:
                denom = 1e-8
            alpha_factor = ((d - t0) / denom).clamp(0.0, 1.0)
            out_a = (src_a * alpha_factor).clamp(0.0, 1.0)

        out = torch.cat([src_rgb, out_a], dim=-1)
        return (out,)


NODE_CLASS_MAPPINGS = {
    "AK Replace Color with Alpha": AKReplaceColorWithAlpha,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Replace Color with Alpha": "AK Replace Color with Alpha",
}
