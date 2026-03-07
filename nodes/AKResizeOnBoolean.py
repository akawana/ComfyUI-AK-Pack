import torch
import torch.nn.functional as F
from PIL import Image
import re


class AKResizeOnBoolean:
    STANDARD_BOUNDS = [
        "User Width x Height",
        "1152 x 640",
        "1344 x 768",
        "1536 x 896",
        "1792 x 1024",
        "2048 x 1152",
        "640 x 1152",
        "768 x 1344",
        "896 x 1536",
        "1024 x 1792",
        "1152 x 2048",
    ]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "do_resize": ("BOOLEAN", {"default": True}),
                "resize_to_bounds": (cls.STANDARD_BOUNDS, {"default": "User Width x Height"}),
                "width": ("INT", {"default": 0, "min": 0, "step": 1}),
                "height": ("INT", {"default": 0, "min": 0, "step": 1}),
                "resize_algorithm": (["nearest-exact", "bilinear", "bicubic", "lanczos"], {"default": "nearest-exact"}),
                "resize_type": (["stretch", "fit", "pad", "crop"], {"default": "stretch"}),
                "pad_color": ("STRING", {"default": "0, 0, 0"}),
                "crop_position": (["center", "top", "bottom", "left", "right"], {"default": "center"}),
            },
            "optional": {
                "image": ("IMAGE",),
                "mask": ("MASK",),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask")
    FUNCTION = "run"
    CATEGORY = "AK/image"

    def _empty_image(self, device=None):
        device = device or torch.device("cpu")
        return torch.zeros((1, 1, 1, 3), dtype=torch.float32, device=device)

    def _empty_mask(self, device=None):
        device = device or torch.device("cpu")
        return torch.zeros((1, 1, 1), dtype=torch.float32, device=device)

    def _parse_pad_color(self, s: str):
        nums = re.findall(r"-?\d+", s or "")
        if len(nums) >= 3:
            rgb = [int(nums[0]), int(nums[1]), int(nums[2])]
        else:
            rgb = [0, 0, 0]
        rgb = [max(0, min(255, v)) for v in rgb]
        return (rgb[0], rgb[1], rgb[2])

    def _parse_resize_to_bounds(self, value: str, fallback_w: int, fallback_h: int):
        if value == "User Width x Height":
            return fallback_w, fallback_h
        match = re.match(r"^\s*(\d+)\s*x\s*(\d+)\s*$", value or "")
        if match:
            return int(match.group(1)), int(match.group(2))
        return fallback_w, fallback_h

    def _to_pil_rgb(self, img: torch.Tensor) -> Image.Image:
        x = img.detach()
        if x.ndim == 4:
            x = x[0]
        x = x.clamp(0, 1)
        x = (x * 255.0).round().to(torch.uint8).cpu().numpy()
        return Image.fromarray(x, mode="RGB")

    def _to_pil_l(self, m: torch.Tensor) -> Image.Image:
        x = m.detach()
        if x.ndim == 3:
            x = x[0]
        x = x.clamp(0, 1)
        x = (x * 255.0).round().to(torch.uint8).cpu().numpy()
        return Image.fromarray(x, mode="L")

    def _from_pil_rgb(self, pil: Image.Image, device) -> torch.Tensor:
        b = pil.tobytes()
        arr = torch.frombuffer(b, dtype=torch.uint8)
        arr = arr.view(pil.size[1], pil.size[0], 3).clone()
        t = arr.to(dtype=torch.float32, device=device) / 255.0
        return t.unsqueeze(0)

    def _from_pil_l(self, pil: Image.Image, device) -> torch.Tensor:
        b = pil.tobytes()
        arr = torch.frombuffer(b, dtype=torch.uint8)
        arr = arr.view(pil.size[1], pil.size[0]).clone()
        t = arr.to(dtype=torch.float32, device=device) / 255.0
        return t.unsqueeze(0)

    def _resize_tensor_stretch(self, x_nchw: torch.Tensor, out_w: int, out_h: int, mode: str):
        if out_w <= 0 or out_h <= 0:
            return x_nchw
        if mode == "nearest":
            return F.interpolate(x_nchw, size=(out_h, out_w), mode="nearest")
        if mode == "bilinear":
            return F.interpolate(x_nchw, size=(out_h, out_w), mode="bilinear", align_corners=False)
        return F.interpolate(x_nchw, size=(out_h, out_w), mode=mode, align_corners=False)

    def _compute_fit_size(self, in_w: int, in_h: int, out_w: int, out_h: int):
        if out_w <= 0 or out_h <= 0 or in_w <= 0 or in_h <= 0:
            return in_w, in_h
        scale = min(out_w / in_w, out_h / in_h)
        nw = max(1, int(round(in_w * scale)))
        nh = max(1, int(round(in_h * scale)))
        return nw, nh

    def _compute_cover_size(self, in_w: int, in_h: int, out_w: int, out_h: int):
        if out_w <= 0 or out_h <= 0 or in_w <= 0 or in_h <= 0:
            return in_w, in_h
        scale = max(out_w / in_w, out_h / in_h)
        nw = max(1, int(round(in_w * scale)))
        nh = max(1, int(round(in_h * scale)))
        return nw, nh

    def _offsets_by_position(self, canvas_w: int, canvas_h: int, inner_w: int, inner_h: int, pos: str):
        if pos == "top":
            x0 = (canvas_w - inner_w) // 2
            y0 = 0
        elif pos == "bottom":
            x0 = (canvas_w - inner_w) // 2
            y0 = canvas_h - inner_h
        elif pos == "left":
            x0 = 0
            y0 = (canvas_h - inner_h) // 2
        elif pos == "right":
            x0 = canvas_w - inner_w
            y0 = (canvas_h - inner_h) // 2
        else:
            x0 = (canvas_w - inner_w) // 2
            y0 = (canvas_h - inner_h) // 2
        return x0, y0

    def _resize_image(self, image: torch.Tensor, out_w: int, out_h: int, alg: str, rtype: str, pad_color: str, crop_pos: str):
        if image is None:
            return None
        device = image.device
        b, h, w, c = image.shape
        if out_w <= 0 or out_h <= 0:
            return image

        if alg == "lanczos":
            fill = self._parse_pad_color(pad_color)
            out_list = []
            for i in range(b):
                pil = self._to_pil_rgb(image[i:i+1])
                if rtype == "stretch":
                    pil2 = pil.resize((out_w, out_h), Image.Resampling.LANCZOS)
                elif rtype == "fit":
                    nw, nh = self._compute_fit_size(w, h, out_w, out_h)
                    pil2 = pil.resize((nw, nh), Image.Resampling.LANCZOS)
                elif rtype == "pad":
                    nw, nh = self._compute_fit_size(w, h, out_w, out_h)
                    inner = pil.resize((nw, nh), Image.Resampling.LANCZOS)
                    canvas = Image.new("RGB", (out_w, out_h), fill)
                    x0, y0 = self._offsets_by_position(out_w, out_h, nw, nh, "center")
                    canvas.paste(inner, (x0, y0))
                    pil2 = canvas
                else:
                    nw, nh = self._compute_cover_size(w, h, out_w, out_h)
                    inner = pil.resize((nw, nh), Image.Resampling.LANCZOS)
                    x0, y0 = self._offsets_by_position(nw, nh, out_w, out_h, crop_pos)
                    x0 = max(0, min(nw - out_w, x0))
                    y0 = max(0, min(nh - out_h, y0))
                    pil2 = inner.crop((x0, y0, x0 + out_w, y0 + out_h))
                out_list.append(self._from_pil_rgb(pil2, device))
            return torch.cat(out_list, dim=0)

        mode = "nearest" if alg == "nearest-exact" else ("bilinear" if alg == "bilinear" else "bicubic")
        x = image.permute(0, 3, 1, 2)

        if rtype == "stretch":
            y = self._resize_tensor_stretch(x, out_w, out_h, mode)
            return y.permute(0, 2, 3, 1)

        if rtype == "fit":
            nw, nh = self._compute_fit_size(w, h, out_w, out_h)
            y = self._resize_tensor_stretch(x, nw, nh, mode)
            return y.permute(0, 2, 3, 1)

        if rtype == "pad":
            nw, nh = self._compute_fit_size(w, h, out_w, out_h)
            inner = self._resize_tensor_stretch(x, nw, nh, mode)
            fill = torch.tensor(self._parse_pad_color(pad_color), device=device, dtype=torch.float32).view(1, 3, 1, 1) / 255.0
            canvas = fill.expand(b, 3, out_h, out_w).clone()
            x0, y0 = self._offsets_by_position(out_w, out_h, nw, nh, "center")
            x0 = max(0, min(out_w - nw, x0))
            y0 = max(0, min(out_h - nh, y0))
            canvas[:, :, y0:y0+nh, x0:x0+nw] = inner
            return canvas.permute(0, 2, 3, 1)

        nw, nh = self._compute_cover_size(w, h, out_w, out_h)
        inner = self._resize_tensor_stretch(x, nw, nh, mode)
        x0, y0 = self._offsets_by_position(nw, nh, out_w, out_h, crop_pos)
        x0 = max(0, min(nw - out_w, x0))
        y0 = max(0, min(nh - out_h, y0))
        cropped = inner[:, :, y0:y0+out_h, x0:x0+out_w]
        return cropped.permute(0, 2, 3, 1)

    def _resize_mask(self, mask: torch.Tensor, out_w: int, out_h: int, alg: str, rtype: str, crop_pos: str):
        if mask is None:
            return None
        device = mask.device
        b, h, w = mask.shape
        if out_w <= 0 or out_h <= 0:
            return mask

        if alg == "lanczos":
            out_list = []
            for i in range(b):
                pil = self._to_pil_l(mask[i:i+1])
                if rtype == "stretch":
                    pil2 = pil.resize((out_w, out_h), Image.Resampling.LANCZOS)
                elif rtype == "fit":
                    nw, nh = self._compute_fit_size(w, h, out_w, out_h)
                    pil2 = pil.resize((nw, nh), Image.Resampling.LANCZOS)
                elif rtype == "pad":
                    nw, nh = self._compute_fit_size(w, h, out_w, out_h)
                    inner = pil.resize((nw, nh), Image.Resampling.LANCZOS)
                    canvas = Image.new("L", (out_w, out_h), 0)
                    x0, y0 = self._offsets_by_position(out_w, out_h, nw, nh, "center")
                    canvas.paste(inner, (x0, y0))
                    pil2 = canvas
                else:
                    nw, nh = self._compute_cover_size(w, h, out_w, out_h)
                    inner = pil.resize((nw, nh), Image.Resampling.LANCZOS)
                    x0, y0 = self._offsets_by_position(nw, nh, out_w, out_h, crop_pos)
                    x0 = max(0, min(nw - out_w, x0))
                    y0 = max(0, min(nh - out_h, y0))
                    pil2 = inner.crop((x0, y0, x0 + out_w, y0 + out_h))
                out_list.append(self._from_pil_l(pil2, device))
            return torch.cat(out_list, dim=0)

        mode = "nearest" if alg == "nearest-exact" else ("bilinear" if alg == "bilinear" else "bicubic")
        x = mask.unsqueeze(1)

        if rtype == "stretch":
            y = self._resize_tensor_stretch(x, out_w, out_h, mode)
            return y[:, 0, :, :]

        if rtype == "fit":
            nw, nh = self._compute_fit_size(w, h, out_w, out_h)
            y = self._resize_tensor_stretch(x, nw, nh, mode)
            return y[:, 0, :, :]

        if rtype == "pad":
            nw, nh = self._compute_fit_size(w, h, out_w, out_h)
            inner = self._resize_tensor_stretch(x, nw, nh, mode)[:, 0, :, :]
            canvas = torch.zeros((b, out_h, out_w), dtype=mask.dtype, device=device)
            x0, y0 = self._offsets_by_position(out_w, out_h, nw, nh, "center")
            x0 = max(0, min(out_w - nw, x0))
            y0 = max(0, min(out_h - nh, y0))
            canvas[:, y0:y0+nh, x0:x0+nw] = inner
            return canvas

        nw, nh = self._compute_cover_size(w, h, out_w, out_h)
        inner = self._resize_tensor_stretch(x, nw, nh, mode)[:, 0, :, :]
        x0, y0 = self._offsets_by_position(nw, nh, out_w, out_h, crop_pos)
        x0 = max(0, min(nw - out_w, x0))
        y0 = max(0, min(nh - out_h, y0))
        return inner[:, y0:y0+out_h, x0:x0+out_w]

    def run(self, do_resize=True, resize_to_bounds="User Width x Height", width=0, height=0, resize_algorithm="nearest-exact",
            resize_type="stretch", pad_color="0, 0, 0", crop_position="center",
            image=None, mask=None):

        out_img = image
        out_mask = mask

        if image is None and mask is None:
            dev = torch.device("cpu")
            return (self._empty_image(dev), self._empty_mask(dev))

        device = (image.device if image is not None else mask.device)

        if not do_resize:
            if out_img is None:
                out_img = self._empty_image(device)
            if out_mask is None:
                out_mask = self._empty_mask(device)
            return (out_img, out_mask)

        user_w = int(width) if width is not None else 0
        user_h = int(height) if height is not None else 0
        out_w, out_h = self._parse_resize_to_bounds(resize_to_bounds, user_w, user_h)

        if out_img is not None:
            out_img = self._resize_image(out_img, out_w, out_h, resize_algorithm, resize_type, pad_color, crop_position)
        if out_mask is not None:
            out_mask = self._resize_mask(out_mask, out_w, out_h, resize_algorithm, resize_type, crop_position)

        if out_img is None:
            out_img = self._empty_image(device)
        if out_mask is None:
            out_mask = self._empty_mask(device)

        return (out_img, out_mask)


NODE_CLASS_MAPPINGS = {
    "AKResizeOnBoolean": AKResizeOnBoolean
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKResizeOnBoolean": "AK Resize On Boolean"
}
