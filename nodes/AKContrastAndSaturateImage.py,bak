import torch
import numpy as np
from PIL import Image

# Hue band definitions (soft ranges in degrees)
FEATHER_DEG = 15.0

RED_RANGES_SOFT = [(315.0, 345.0), (15.0, 45.0)]
YELLOW_RANGES_SOFT = [(15.0, 45.0), (75.0, 105.0)]
GREEN_RANGES_SOFT = [(75.0, 105.0), (135.0, 165.0)]
CYAN_RANGES_SOFT = [(135.0, 165.0), (195.0, 225.0)]
BLUE_RANGES_SOFT = [(195.0, 225.0), (225.0, 285.0)]
MAGENTA_RANGES_SOFT = [(255.0, 285.0), (315.0, 345.0)]


def _compute_band_weight(h_deg: np.ndarray, ranges_soft):
    """Compute per-pixel weight for a hue band with soft feathered edges."""
    if h_deg.ndim != 2:
        raise ValueError("Expected 2D hue array")

    weight_total = np.zeros_like(h_deg, dtype=np.float32)

    for start_soft, end_soft in ranges_soft:
        width = end_soft - start_soft
        if width <= 0.0:
            continue

        feather = min(FEATHER_DEG, width * 0.5)
        start_hard = start_soft + feather
        end_hard = end_soft - feather

        seg_weight = np.zeros_like(h_deg, dtype=np.float32)

        # Fully inside hard region
        inside_hard = (h_deg >= start_hard) & (h_deg <= end_hard)
        seg_weight[inside_hard] = 1.0

        # Soft rising edge
        if feather > 0.0:
            rising = (h_deg >= start_soft) & (h_deg < start_hard)
            seg_weight[rising] = (h_deg[rising] - start_soft) / feather

            falling = (h_deg > end_hard) & (h_deg <= end_soft)
            seg_weight[falling] = (end_soft - h_deg[falling]) / feather

        weight_total = np.maximum(weight_total, seg_weight)

    return weight_total


def _slider_to_factor(value: int) -> float:
    """Convert slider value in [-100, 100] to saturation multiplier."""
    v = float(value)
    return max(0.0, 1.0 + v / 100.0)

def _apply_brightness_contrast_rgb01(frame: np.ndarray, brightness: int, contrast: int) -> np.ndarray:
    """Apply brightness and contrast to an RGB image in [0,1] float32 format."""
    out = frame.astype(np.float32, copy=False)

    if brightness != 0:
        out = out + (float(brightness) / 100.0)

    if contrast != 0:
        factor = 1.0 + (float(contrast) / 100.0)
        out = (out - 0.5) * factor + 0.5

    return np.clip(out, 0.0, 1.0)



class AKContrastAndSaturateImage:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "brightness": (
                    "INT",
                    {
                        "default": 0,
                        "min": -100,
                        "max": 100,
                        "step": 1,
                    },
                ),
                "contrast": (
                    "INT",
                    {
                        "default": 0,
                        "min": -100,
                        "max": 100,
                        "step": 1,
                    },
                ),
                "master": (
                    "INT",
                    {
                        "default": 0,
                        "min": -100,
                        "max": 100,
                        "step": 1,
                    },
                ),
                "reds": (
                    "INT",
                    {
                        "default": 0,
                        "min": -100,
                        "max": 100,
                        "step": 1,
                    },
                ),
                "yellows": (
                    "INT",
                    {
                        "default": 0,
                        "min": -100,
                        "max": 100,
                        "step": 1,
                    },
                ),
                "greens": (
                    "INT",
                    {
                        "default": 0,
                        "min": -100,
                        "max": 100,
                        "step": 1,
                    },
                ),
                "cyans": (
                    "INT",
                    {
                        "default": 0,
                        "min": -100,
                        "max": 100,
                        "step": 1,
                    },
                ),
                "blues": (
                    "INT",
                    {
                        "default": 0,
                        "min": -100,
                        "max": 100,
                        "step": 1,
                    },
                ),
                "magentas": (
                    "INT",
                    {
                        "default": 0,
                        "min": -100,
                        "max": 100,
                        "step": 1,
                    },
                ),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "apply"
    CATEGORY = "AK/image"

    def apply(
        self,
        image: torch.Tensor,
        brightness: int,
        contrast: int,
        master: int,
        reds: int,
        yellows: int,
        greens: int,
        cyans: int,
        blues: int,
        magentas: int,
    ):
        if not isinstance(image, torch.Tensor):
            raise TypeError("Expected image as torch.Tensor")

        if image.ndim != 4 or image.shape[-1] != 3:
            raise ValueError("Expected image with shape [B, H, W, 3]")

        if (
            brightness == 0
            and contrast == 0
            and master == 0
            and reds == 0
            and yellows == 0
            and greens == 0
            and cyans == 0
            and blues == 0
            and magentas == 0
        ):
            return (image,)

        device = image.device
        batch_size, h, w, c = image.shape

        img_np = image.detach().cpu().numpy()
        out_list = []

        master_factor = _slider_to_factor(master)
        reds_factor = _slider_to_factor(reds)
        yellows_factor = _slider_to_factor(yellows)
        greens_factor = _slider_to_factor(greens)
        cyans_factor = _slider_to_factor(cyans)
        blues_factor = _slider_to_factor(blues)
        magentas_factor = _slider_to_factor(magentas)

        for i in range(batch_size):
            frame = img_np[i]

            if brightness != 0 or contrast != 0:
                frame = _apply_brightness_contrast_rgb01(frame, brightness, contrast)

            frame_u8 = (frame * 255.0).clip(0, 255).astype(np.uint8)

            pil_rgb = Image.fromarray(frame_u8, mode="RGB")
            pil_hsv = pil_rgb.convert("HSV")
            hsv = np.array(pil_hsv, dtype=np.uint8)

            H = hsv[..., 0].astype(np.float32)
            S = hsv[..., 1].astype(np.float32)
            V = hsv[..., 2]

            h_deg = H * (360.0 / 255.0)

            # Base master factor
            S = S * master_factor

            # Per-band masks
            reds_w = _compute_band_weight(h_deg, RED_RANGES_SOFT)
            yellows_w = _compute_band_weight(h_deg, YELLOW_RANGES_SOFT)
            greens_w = _compute_band_weight(h_deg, GREEN_RANGES_SOFT)
            cyans_w = _compute_band_weight(h_deg, CYAN_RANGES_SOFT)
            blues_w = _compute_band_weight(h_deg, BLUE_RANGES_SOFT)
            magentas_w = _compute_band_weight(h_deg, MAGENTA_RANGES_SOFT)

            # Sequential multiplicative adjustments
            def apply_band(S_arr, weight, factor):
                if factor == 1.0:
                    return S_arr
                band_scale = 1.0 + weight * (factor - 1.0)
                return S_arr * band_scale

            S = apply_band(S, reds_w, reds_factor)
            S = apply_band(S, yellows_w, yellows_factor)
            S = apply_band(S, greens_w, greens_factor)
            S = apply_band(S, cyans_w, cyans_factor)
            S = apply_band(S, blues_w, blues_factor)
            S = apply_band(S, magentas_w, magentas_factor)

            S = np.clip(S, 0.0, 255.0).astype(np.uint8)

            hsv_new = np.stack(
                [
                    H.astype(np.uint8),
                    S,
                    V.astype(np.uint8),
                ],
                axis=-1,
            )

            pil_hsv_new = Image.fromarray(hsv_new, mode="HSV")
            pil_rgb_new = pil_hsv_new.convert("RGB")
            rgb_np = np.array(pil_rgb_new).astype(np.float32) / 255.0
            out_list.append(rgb_np)

        out_np = np.stack(out_list, axis=0)
        out_tensor = torch.from_numpy(out_np).to(device)
        return (out_tensor,)


NODE_CLASS_MAPPINGS = {
    "AKContrastAndSaturateImage": AKContrastAndSaturateImage,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "AKContrastAndSaturateImage": "AK Contrast & Saturate Image",
}
