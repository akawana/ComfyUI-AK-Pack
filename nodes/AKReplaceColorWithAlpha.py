import torch
import re

class AKReplaceColorWithAlpha:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "crop_size": ("INT", {"default": 0, "min": 0, "step": 1}),
                "color_pick_mode": (["user_color", "left_top_pixel", "right_top_pixel", "left_bottom_pixel", "right_bottom_pixel"], {"default": "user_color"}),
                "color_rgb": ("STRING", {"default": "8, 39, 245", "multiline": False}),
                "threshold": ("INT", {"default": 0, "min": 0, "max": 255, "step": 1}),
                "softness": ("INT", {"default": 0, "min": 0, "max": 255, "step": 1}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "replace_color"
    CATEGORY = "AK/image"

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
        return src_rgb[0, y, x, :].clamp(0.0, 1.0)

    @staticmethod
    def _compute_crop(h: int, w: int, crop_size: int):
        p = int(crop_size)
        if p <= 0:
            return (0, 0, 0, 0)

        # Preserve aspect: shrink the larger dimension by p, shrink the other proportionally.
        if w >= h:
            sub_w = min(p, max(0, w - 1))
            sub_h = int(round(sub_w * (h / max(1, w))))
        else:
            sub_h = min(p, max(0, h - 1))
            sub_w = int(round(sub_h * (w / max(1, h))))

        left = sub_w // 2
        right = sub_w - left
        top = sub_h // 2
        bottom = sub_h - top
        return (left, right, top, bottom)

    @staticmethod
    def _center_crop(img: torch.Tensor, crop_size: int):
        # img: [B,H,W,C]
        if img is None or img.dim() != 4:
            return img
        b, h, w, c = img.shape
        left, right, top, bottom = AKReplaceColorWithAlpha._compute_crop(h, w, crop_size)
        if left == 0 and right == 0 and top == 0 and bottom == 0:
            return img
        y0 = top
        y1 = h - bottom
        x0 = left
        x1 = w - right
        if y1 <= y0 or x1 <= x0:
            return img
        return img[:, y0:y1, x0:x1, :]

    def replace_color(self, image, crop_size, color_pick_mode, color_rgb, threshold, softness):
        if image.dim() != 4:
            return (image,)

        cs = int(crop_size) if crop_size is not None else 0
        if cs > 0:
            image = self._center_crop(image, cs)

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
