import torch
import torch.nn.functional as F
import re

class AKReplaceAlphaWithColor:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "color_pick_mode": (["user_color", "auto_color"], {"default": "user_color"}),
                "threshold": ("INT", {"default": 0, "min": 0, "max": 255, "step": 1}),
                "image": ("IMAGE",),
                "color_rgb": ("STRING", {"default": "8, 39, 245", "multiline": False}),
                "pad_size": ("INT", {"default": 0, "min": 0, "step": 1}),
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

    @staticmethod
    def _auto_pick_color(src_rgb_01: torch.Tensor, threshold_255: int):
        if src_rgb_01.dim() != 4 or src_rgb_01.shape[-1] != 3:
            return None

        thr = int(threshold_255)
        if thr < 0:
            thr = 0
        elif thr > 255:
            thr = 255

        pix = src_rgb_01.reshape(-1, 3).clamp(0.0, 1.0)
        n = int(pix.shape[0])
        if n <= 0:
            return None

        max_samples = 20000
        if n > max_samples:
            idx = torch.randperm(n, device=pix.device)[:max_samples]
            pix = pix.index_select(0, idx)

        pix255 = (pix * 255.0).round()

        step = 16
        vals = torch.arange(0, 256, step, device=pix.device, dtype=pix255.dtype)

        try:
            rr, gg, bb = torch.meshgrid(vals, vals, vals, indexing="ij")
        except TypeError:
            rr, gg, bb = torch.meshgrid(vals, vals, vals)

        cand = torch.stack([rr.reshape(-1), gg.reshape(-1), bb.reshape(-1)], dim=1)
        m = int(cand.shape[0])

        best_min_d2 = None
        best = None

        pix255_t = pix255.t().contiguous()
        p2 = (pix255 * pix255).sum(dim=1).view(1, -1)

        chunk = 256
        for s in range(0, m, chunk):
            c = cand[s:s + chunk]
            c2 = (c * c).sum(dim=1, keepdim=True)
            cross = 2.0 * (c @ pix255_t)
            d2 = (c2 + p2 - cross).clamp_min(0.0)
            min_d2 = d2.min(dim=1).values

            cur_best_val = min_d2.max()
            if best_min_d2 is None or cur_best_val > best_min_d2:
                best_min_d2 = cur_best_val
                best_idx = int(min_d2.argmax().item())
                best = c[best_idx]

        if best is None or best_min_d2 is None:
            return None

        thr2 = float(thr * thr)
        if float(best_min_d2.item()) <= thr2 + 1e-6:
            return None

        return (int(best[0].item()), int(best[1].item()), int(best[2].item()))

    @staticmethod
    def _compute_pad(h: int, w: int, pad_size: int):
        p = int(pad_size)
        if p <= 0:
            return (0, 0, 0, 0)

        if w >= h:
            add_w = p
            add_h = int(round(p * (h / max(1, w))))
        else:
            add_h = p
            add_w = int(round(p * (w / max(1, h))))

        left = add_w // 2
        right = add_w - left
        top = add_h // 2
        bottom = add_h - top
        return (left, right, top, bottom)

    def replace_alpha(self, color_pick_mode, threshold, image, color_rgb, pad_size=0, mask=None):
        if image.dim() != 4:
            return (image,)

        c = image.shape[-1]
        if c < 3:
            return (image,)

        src_rgb = image[..., :3].clamp(0.0, 1.0)

        mode = str(color_pick_mode or "user_color")
        thr = int(threshold) if threshold is not None else 0

        if mode == "auto_color":
            picked = self._auto_pick_color(src_rgb, thr)
            if picked is None:
                picked = self._parse_rgb(color_rgb)
        else:
            picked = self._parse_rgb(color_rgb)

        color = torch.tensor([picked[0], picked[1], picked[2]], device=image.device, dtype=image.dtype) / 255.0
        color_view = color.view(1, 1, 1, 3).expand_as(src_rgb)

        if mask is not None:
            m = mask
            if m.dim() == 3:
                m = m.unsqueeze(-1)
            elif m.dim() == 4 and m.shape[-1] != 1:
                m = m[..., :1]
            m = m.to(device=image.device, dtype=image.dtype).clamp(0.0, 1.0)
            out = src_rgb * (1.0 - m) + color_view * m
        else:
            if c < 4:
                out = image
            else:
                alpha = image[..., 3:4].clamp(0.0, 1.0)
                out = src_rgb * alpha + color_view * (1.0 - alpha)

        p = int(pad_size) if pad_size is not None else 0
        if p > 0 and out.dim() == 4 and out.shape[-1] >= 3:
            b, h, w, ch = out.shape
            left, right, top, bottom = self._compute_pad(h, w, p)
            if left or right or top or bottom:
                out_nchw = out[..., :3].permute(0, 3, 1, 2).contiguous()
                padded = []
                for ci in range(3):
                    v = float(color[ci].item())
                    ch_t = out_nchw[:, ci:ci+1, :, :]
                    ch_p = F.pad(ch_t, (left, right, top, bottom), mode="constant", value=v)
                    padded.append(ch_p)
                out_nchw = torch.cat(padded, dim=1)
                out = out_nchw.permute(0, 2, 3, 1).contiguous()

        return (out,)


NODE_CLASS_MAPPINGS = {
    "AK Replace Alpha with Color": AKReplaceAlphaWithColor,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Replace Alpha with Color": "AK Replace Alpha with Color",
}
