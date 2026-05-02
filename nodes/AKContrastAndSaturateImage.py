import torch
import numpy as np
from PIL import Image

from comfy_api.latest import ComfyExtension, io

# ── Hue band definitions (soft ranges in degrees) ────────────────────────────

FEATHER_DEG = 15.0

RED_RANGES_SOFT     = [(315.0, 345.0), (15.0,  45.0)]
YELLOW_RANGES_SOFT  = [(15.0,  45.0),  (75.0,  105.0)]
GREEN_RANGES_SOFT   = [(75.0,  105.0), (135.0, 165.0)]
CYAN_RANGES_SOFT    = [(135.0, 165.0), (195.0, 225.0)]
BLUE_RANGES_SOFT    = [(195.0, 225.0), (225.0, 285.0)]
MAGENTA_RANGES_SOFT = [(255.0, 285.0), (315.0, 345.0)]


def _compute_band_weight(h_deg: np.ndarray, ranges_soft) -> np.ndarray:
    weight_total = np.zeros_like(h_deg, dtype=np.float32)
    for start_soft, end_soft in ranges_soft:
        width = end_soft - start_soft
        if width <= 0.0:
            continue
        feather    = min(FEATHER_DEG, width * 0.5)
        start_hard = start_soft + feather
        end_hard   = end_soft   - feather
        seg_weight = np.zeros_like(h_deg, dtype=np.float32)
        seg_weight[(h_deg >= start_hard) & (h_deg <= end_hard)] = 1.0
        if feather > 0.0:
            rising  = (h_deg >= start_soft) & (h_deg < start_hard)
            falling = (h_deg > end_hard)    & (h_deg <= end_soft)
            seg_weight[rising]  = (h_deg[rising]  - start_soft) / feather
            seg_weight[falling] = (end_soft - h_deg[falling])   / feather
        weight_total = np.maximum(weight_total, seg_weight)
    return weight_total


def _slider_to_factor(value: int) -> float:
    return max(0.0, 1.0 + float(value) / 100.0)


def _apply_brightness_contrast(frame: np.ndarray, brightness: int, contrast: int) -> np.ndarray:
    out = frame.astype(np.float32, copy=False)
    if brightness != 0:
        out = out + float(brightness) / 100.0
    if contrast != 0:
        factor = 1.0 + float(contrast) / 100.0
        out = (out - 0.5) * factor + 0.5
    return np.clip(out, 0.0, 1.0)


def _apply_auto_levels(frame: np.ndarray) -> np.ndarray:
    """
    Photoshop-style Auto Levels: stretch each RGB channel independently
    so that the darkest pixel becomes 0 and the brightest becomes 1.
    Uses 0.5% clip on each tail to ignore extreme outliers.
    """
    out = frame.astype(np.float32, copy=False)
    for c in range(3):
        ch = out[..., c]
        lo = float(np.percentile(ch, 0.5))
        hi = float(np.percentile(ch, 99.5))
        if hi > lo:
            out[..., c] = np.clip((ch - lo) / (hi - lo), 0.0, 1.0)
    return out


class AKContrastAndSaturateImage(io.ComfyNode):

    @classmethod
    def define_schema(cls) -> io.Schema:
        int_input = lambda name, default=0: io.Int.Input(
            name, default=default, min=-100, max=100, step=1
        )
        return io.Schema(
            node_id="AKContrastAndSaturateImage",
            display_name="AK Contrast & Saturate Image",
            category="AK/image",
            description="Adjust brightness, contrast, auto levels, and per-channel saturation.",
            inputs=[
                io.Image.Input("image"),
                io.Boolean.Input("auto_levels", default=False,
                                 tooltip="Stretch each channel to full range (Photoshop Auto Levels)."),
                int_input("brightness"),
                int_input("contrast"),
                int_input("master"),
                int_input("reds"),
                int_input("yellows"),
                int_input("greens"),
                int_input("cyans"),
                int_input("blues"),
                int_input("magentas"),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ],
        )

    @classmethod
    def execute(
        cls,
        image: torch.Tensor,
        auto_levels: bool,
        brightness: int,
        contrast: int,
        master: int,
        reds: int,
        yellows: int,
        greens: int,
        cyans: int,
        blues: int,
        magentas: int,
    ) -> io.NodeOutput:

        if not isinstance(image, torch.Tensor):
            raise TypeError("Expected image as torch.Tensor")
        if image.ndim != 4 or image.shape[-1] != 3:
            raise ValueError("Expected image with shape [B, H, W, 3]")

        all_zero = (
            not auto_levels
            and brightness == 0 and contrast == 0
            and master == 0
            and reds == 0 and yellows == 0 and greens == 0
            and cyans == 0 and blues == 0 and magentas == 0
        )
        if all_zero:
            return io.NodeOutput(image)

        device   = image.device
        img_np   = image.detach().cpu().numpy()
        out_list = []

        master_f   = _slider_to_factor(master)
        reds_f     = _slider_to_factor(reds)
        yellows_f  = _slider_to_factor(yellows)
        greens_f   = _slider_to_factor(greens)
        cyans_f    = _slider_to_factor(cyans)
        blues_f    = _slider_to_factor(blues)
        magentas_f = _slider_to_factor(magentas)

        for i in range(img_np.shape[0]):
            frame = img_np[i]

            if auto_levels:
                frame = _apply_auto_levels(frame)

            if brightness != 0 or contrast != 0:
                frame = _apply_brightness_contrast(frame, brightness, contrast)

            # ── Saturation in HSV ─────────────────────────────────────────
            frame_u8 = (frame * 255.0).clip(0, 255).astype(np.uint8)
            hsv      = np.array(Image.fromarray(frame_u8, "RGB").convert("HSV"), dtype=np.uint8)

            H   = hsv[..., 0].astype(np.float32)
            S   = hsv[..., 1].astype(np.float32)
            V   = hsv[..., 2]
            h_deg = H * (360.0 / 255.0)

            S = S * master_f

            def apply_band(S_arr, weight, factor):
                if factor == 1.0:
                    return S_arr
                return S_arr * (1.0 + weight * (factor - 1.0))

            S = apply_band(S, _compute_band_weight(h_deg, RED_RANGES_SOFT),     reds_f)
            S = apply_band(S, _compute_band_weight(h_deg, YELLOW_RANGES_SOFT),  yellows_f)
            S = apply_band(S, _compute_band_weight(h_deg, GREEN_RANGES_SOFT),   greens_f)
            S = apply_band(S, _compute_band_weight(h_deg, CYAN_RANGES_SOFT),    cyans_f)
            S = apply_band(S, _compute_band_weight(h_deg, BLUE_RANGES_SOFT),    blues_f)
            S = apply_band(S, _compute_band_weight(h_deg, MAGENTA_RANGES_SOFT), magentas_f)

            S = np.clip(S, 0.0, 255.0).astype(np.uint8)

            hsv_new = np.stack([H.astype(np.uint8), S, V.astype(np.uint8)], axis=-1)
            rgb_np  = np.array(
                Image.fromarray(hsv_new, "HSV").convert("RGB"), dtype=np.float32
            ) / 255.0
            out_list.append(rgb_np)

        out_tensor = torch.from_numpy(np.stack(out_list, axis=0)).to(device)
        return io.NodeOutput(out_tensor)


class AKContrastAndSaturateImageExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [AKContrastAndSaturateImage]


async def comfy_entrypoint() -> AKContrastAndSaturateImageExtension:
    return AKContrastAndSaturateImageExtension()


NODE_CLASS_MAPPINGS = {
    "AKContrastAndSaturateImage": AKContrastAndSaturateImage,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "AKContrastAndSaturateImage": "AK Contrast & Saturate Image",
}
