import torch
import re

class AKReplaceAlphaWithColor:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "color_rgb": ("STRING", {"default": "8, 39, 245", "multiline": False}),
            },
            "optional": {
                "mask": ("MASK",),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "replace_alpha"
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

    def replace_alpha(self, image, color_rgb, mask=None):
        rgb = self._parse_rgb(color_rgb)
        color = torch.tensor([rgb[0], rgb[1], rgb[2]], device=image.device, dtype=image.dtype) / 255.0

        # ComfyUI IMAGE is typically [B, H, W, C] in 0..1
        if image.dim() != 4:
            return (image,)

        c = image.shape[-1]
        if c < 3:
            return (image,)

        src_rgb = image[..., :3].clamp(0.0, 1.0)
        color_view = color.view(1, 1, 1, 3).expand_as(src_rgb)

        # If mask is provided: replace by mask (white=1.0) regardless of alpha.
        if mask is not None:
            m = mask
            # MASK is typically [B, H, W] in 0..1
            if m.dim() == 3:
                m = m.unsqueeze(-1)
            elif m.dim() == 4 and m.shape[-1] != 1:
                # If someone passes an IMAGE as mask by mistake, use its first channel
                m = m[..., :1]
            m = m.to(device=image.device, dtype=image.dtype).clamp(0.0, 1.0)

            # Blend: where mask is white -> use color, where black -> keep original
            out = src_rgb * (1.0 - m) + color_view * m
            return (out,)

        # Default behavior: replace alpha with the chosen color by compositing over background.
        if c < 4:
            return (image,)

        alpha = image[..., 3:4].clamp(0.0, 1.0)
        out = src_rgb * alpha + color_view * (1.0 - alpha)
        return (out,)


NODE_CLASS_MAPPINGS = {
    "AK Replace Alpha with Color": AKReplaceAlphaWithColor,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Replace Alpha with Color": "AK Replace Alpha with Color",
}
