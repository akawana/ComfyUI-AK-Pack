import torch
import hashlib
from PIL import Image
import re
import numpy as np

from comfy_api.latest import ComfyExtension, io

STANDARD_BOUNDS = [
    "User Width x Height",
    "1024 x 768", "1152 x 640", "1344 x 768", "1536 x 896",
    "1792 x 1024", "2048 x 1152", "768 x 1024", "640 x 1152",
    "768 x 1344", "896 x 1536", "1024 x 1792", "1152 x 2048",
]
PAD_COLOR_SOURCES  = ["User color","Top left corner","Top right corner","Bottom left corner","Bottom right corner"]
RESIZE_ALGORITHMS  = ["lanczos", "bicubic", "bilinear", "nearest-exact"]
RESIZE_TYPES       = ["stretch", "fit", "pad", "crop"]
CROP_PAD_POSITIONS = ["center", "top", "bottom", "left", "right"]
PIL_RESAMPLE = {
    "lanczos":       Image.Resampling.LANCZOS,
    "bicubic":       Image.Resampling.BICUBIC,
    "bilinear":      Image.Resampling.BILINEAR,
    "nearest-exact": Image.Resampling.NEAREST,
}

def _parse_pad_color(s):
    nums = re.findall(r"-?\d+", s or "")
    rgb  = [int(nums[i]) if len(nums) > i else 0 for i in range(3)]
    return tuple(max(0, min(255, v)) for v in rgb)

def _parse_resize_to_bounds(value, fallback_w, fallback_h):
    if value == "User Width x Height":
        return fallback_w, fallback_h
    m = re.match(r"^\s*(\d+)\s*x\s*(\d+)\s*$", value or "")
    return (int(m.group(1)), int(m.group(2))) if m else (fallback_w, fallback_h)

def _sample_corner_color(image, source):
    frame = image[0]
    h, w, _ = frame.shape
    ox, oy = min(2, w-1), min(2, h-1)
    if source == "Top left corner":      px = frame[oy, ox]
    elif source == "Top right corner":   px = frame[oy, w-1-ox]
    elif source == "Bottom left corner": px = frame[h-1-oy, ox]
    else:                                px = frame[h-1-oy, w-1-ox]
    return tuple(max(0, min(255, int(round(float(px[i].item())*255)))) for i in range(3))

def _resolve_pad_color(src, color, image):
    if src == "User color" or image is None:
        return _parse_pad_color(color)
    return _sample_corner_color(image, src)

def _fit_size(in_w, in_h, out_w, out_h):
    if not all([out_w, out_h, in_w, in_h]):
        return in_w, in_h
    scale = min(out_w/in_w, out_h/in_h)
    return max(1, int(round(in_w*scale))), max(1, int(round(in_h*scale)))

def _cover_size(in_w, in_h, out_w, out_h):
    if not all([out_w, out_h, in_w, in_h]):
        return in_w, in_h
    scale = max(out_w/in_w, out_h/in_h)
    return max(1, int(round(in_w*scale))), max(1, int(round(in_h*scale)))

def _offsets(cw, ch, iw, ih, pos):
    if pos == "top":    return (cw-iw)//2, 0
    if pos == "bottom": return (cw-iw)//2, ch-ih
    if pos == "left":   return 0, (ch-ih)//2
    if pos == "right":  return cw-iw, (ch-ih)//2
    return (cw-iw)//2, (ch-ih)//2

def _to_pil_rgb(t):
    x = t.detach()
    if x.ndim == 4: x = x[0]
    return Image.fromarray((x.clamp(0,1)*255).round().to(torch.uint8).cpu().numpy(), "RGB")

def _to_pil_l(t):
    x = t.detach()
    if x.ndim == 3: x = x[0]
    return Image.fromarray((x.clamp(0,1)*255).round().to(torch.uint8).cpu().numpy(), "L")

def _from_pil_rgb(pil, device):
    arr = torch.from_numpy(np.frombuffer(pil.tobytes(), dtype=np.uint8).copy())
    return arr.view(pil.size[1], pil.size[0], 3).to(device=device, dtype=torch.float32).div(255).unsqueeze(0)

def _from_pil_l(pil, device):
    arr = torch.from_numpy(np.frombuffer(pil.tobytes(), dtype=np.uint8).copy())
    return arr.view(pil.size[1], pil.size[0]).to(device=device, dtype=torch.float32).div(255).unsqueeze(0)

def _resize_pil(pil, out_w, out_h, alg, rtype, fill, crop_pos, mode):
    rs = PIL_RESAMPLE.get(alg, Image.Resampling.LANCZOS)
    w, h = pil.size
    if rtype == "stretch":
        result = pil.resize((out_w, out_h), rs)
    elif rtype == "fit":
        nw, nh = _fit_size(w, h, out_w, out_h)
        result = pil.resize((nw, nh), rs)
    elif rtype == "pad":
        nw, nh = _fit_size(w, h, out_w, out_h)
        inner  = pil.resize((nw, nh), rs)
        canvas = Image.new(mode, (out_w, out_h), fill if mode == "RGB" else 0)
        x0, y0 = _offsets(out_w, out_h, nw, nh, crop_pos)
        canvas.paste(inner, (max(0,x0), max(0,y0)))
        result = canvas
    else:  # crop
        nw, nh = _cover_size(w, h, out_w, out_h)
        inner  = pil.resize((nw, nh), rs)
        x0, y0 = _offsets(nw, nh, out_w, out_h, crop_pos)
        x0 = max(0, min(nw-out_w, x0))
        y0 = max(0, min(nh-out_h, y0))
        result = inner.crop((x0, y0, x0+out_w, y0+out_h))
    return result

def _resize_image(image, out_w, out_h, alg, rtype, fill, crop_pos):
    if out_w <= 0 or out_h <= 0: return image
    device = image.device
    b, h, w, _ = image.shape
    return torch.cat([
        _from_pil_rgb(_resize_pil(_to_pil_rgb(image[i:i+1]), out_w, out_h, alg, rtype, fill, crop_pos, "RGB"), device)
        for i in range(b)
    ], dim=0)

def _resize_mask(mask, out_w, out_h, alg, rtype, crop_pos):
    if out_w <= 0 or out_h <= 0: return mask
    device = mask.device
    b, h, w = mask.shape
    return torch.cat([
        _from_pil_l(_resize_pil(_to_pil_l(mask[i:i+1]), out_w, out_h, alg, rtype, None, crop_pos, "L"), device)
        for i in range(b)
    ], dim=0)

def _empty_image(device): return torch.zeros((1,1,1,3), dtype=torch.float32, device=device)
def _empty_mask(device):  return torch.zeros((1,1,1),   dtype=torch.float32, device=device)


class AKResizeOnBoolean(io.ComfyNode):

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="AKResizeOnBoolean",
            display_name="AK Resize On Boolean",
            category="AK/image",
            description="Conditionally resize image and/or mask. All algorithms use PIL.",
            inputs=[
                io.Boolean.Input("do_resize", default=True),
                io.Combo.Input("resize_to_bounds", options=STANDARD_BOUNDS, default="User Width x Height"),
                io.Int.Input("width",  default=0, min=0, step=1),
                io.Int.Input("height", default=0, min=0, step=1),
                io.Combo.Input("resize_algorithm", options=RESIZE_ALGORITHMS, default="lanczos"),
                io.Combo.Input("resize_type",       options=RESIZE_TYPES,      default="stretch"),
                io.Combo.Input("pad_color_source",  options=PAD_COLOR_SOURCES, default="User color",
                               tooltip="Source for pad fill color."),
                io.String.Input("pad_color", default="0, 0, 0",
                                tooltip="RGB fill color when pad_color_source is 'User color'. Format: R, G, B (0-255)."),
                io.Combo.Input("crop_pad_position", options=CROP_PAD_POSITIONS, default="center"),
                io.Image.Input("image", optional=True),
                io.Mask.Input("mask",  optional=True),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
                io.Mask.Output(display_name="mask"),
            ],
        )

    @classmethod
    def fingerprint_inputs(cls, do_resize=True, resize_to_bounds="", width=0, height=0,
                           resize_algorithm="", resize_type="", crop_pad_position="",
                           pad_color_source="", pad_color="", **kwargs) -> str:
        key = f"{do_resize}|{resize_to_bounds}|{width}|{height}|{resize_algorithm}|{resize_type}|{crop_pad_position}|{pad_color_source}|{pad_color}"
        return hashlib.md5(key.encode()).hexdigest()

    @classmethod
    def execute(cls, do_resize, resize_to_bounds, width, height,
                resize_algorithm, resize_type, pad_color_source, pad_color,
                crop_pad_position, image=None, mask=None) -> io.NodeOutput:

        device = (image.device if image is not None else
                  mask.device  if mask  is not None else torch.device("cpu"))

        if image is None and mask is None:
            return io.NodeOutput(_empty_image(device), _empty_mask(device))

        if not do_resize:
            return io.NodeOutput(
                image if image is not None else _empty_image(device),
                mask  if mask  is not None else _empty_mask(device),
            )

        out_w, out_h = _parse_resize_to_bounds(resize_to_bounds, int(width), int(height))
        fill = _resolve_pad_color(pad_color_source, pad_color, image)

        out_img  = _resize_image(image, out_w, out_h, resize_algorithm, resize_type, fill, crop_pad_position) if image is not None else _empty_image(device)
        out_mask = _resize_mask(mask,   out_w, out_h, resize_algorithm, resize_type,       crop_pad_position) if mask  is not None else _empty_mask(device)

        return io.NodeOutput(out_img, out_mask)


class AKResizeOnBooleanExtension(ComfyExtension):
    async def get_node_list(self): return [AKResizeOnBoolean]

async def comfy_entrypoint(): return AKResizeOnBooleanExtension()

NODE_CLASS_MAPPINGS      = {"AKResizeOnBoolean": AKResizeOnBoolean}
NODE_DISPLAY_NAME_MAPPINGS = {"AKResizeOnBoolean": "AK Resize On Boolean"}
