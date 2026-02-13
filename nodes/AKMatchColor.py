import torch
import kornia

import comfy.model_management


class AKMatchColor:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "reference": ("IMAGE",),
                "color_space": (["LAB", "YCbCr", "RGB", "LUV", "YUV", "XYZ"],),
                "factor": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.05}),
                "device": (["auto", "cpu", "gpu"],),
                "batch_size": ("INT", {"default": 0, "min": 0, "max": 1024, "step": 1}),
            },
            "optional": {
                "mask": ("MASK",),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "execute"
    CATEGORY = "AK/image"

    def execute(self, image, reference, color_space, factor, device, batch_size, mask=None):
        if device == "gpu":
            device = comfy.model_management.get_torch_device()
        elif device == "auto":
            device = comfy.model_management.intermediate_device()
        else:
            device = "cpu"

        with torch.no_grad():
            image = image.permute([0, 3, 1, 2])
            reference = reference.permute([0, 3, 1, 2]).to(device)

            if batch_size == 0 or batch_size > image.shape[0]:
                batch_size = image.shape[0]

            # Prepare mask (optional): (B,1,H,W) in [0,1] on device, resized to match each batch if needed.
            if mask is not None:
                assert mask.ndim == 3, f"Expected mask to have 3 dimensions, but got {mask.ndim}"
                if mask.shape[0] != image.shape[0]:
                    raise ValueError(f"Frame count mismatch: mask has {mask.shape[0]} frames, but image has {image.shape[0]}")
                mask_t = mask.unsqueeze(1).to(device).float()
                mask_t = torch.clamp(mask_t, 0.0, 1.0)
            else:
                mask_t = None

            # Convert reference once (global stats like ImageColorMatch)
            reference_cs = self._to_color_space(reference, color_space)
            reference_mean, reference_std = self.compute_mean_std(reference_cs)

            image_batches = torch.split(image, batch_size, dim=0)
            output = []
            if mask_t is not None:
                mask_batches = torch.split(mask_t, batch_size, dim=0)
            else:
                mask_batches = None

            for bi, img in enumerate(image_batches):
                img = img.to(device)

                img_cs = self._to_color_space(img, color_space)
                img_mean, img_std = self.compute_mean_std(img_cs)

                matched = torch.nan_to_num((img_cs - img_mean) / img_std) * torch.nan_to_num(reference_std) + reference_mean
                blended = factor * matched + (1.0 - factor) * img_cs

                if mask_batches is not None:
                    m = mask_batches[bi]
                    # Ensure spatial dims match current batch
                    if m.shape[2:] != blended.shape[2:]:
                        m = kornia.geometry.transform.resize(m, blended.shape[2:], interpolation="bilinear", align_corners=False)
                    out_cs = m * blended + (1.0 - m) * img_cs
                else:
                    out_cs = blended

                out_rgb = self._from_color_space(out_cs, color_space)
                out = out_rgb.permute([0, 2, 3, 1]).clamp(0, 1).to(comfy.model_management.intermediate_device())
                output.append(out)

            output = torch.cat(output, dim=0)
            return (output,)

    def compute_mean_std(self, tensor):
        mean = tensor.mean(dim=(0, 2, 3), keepdim=True)
        std = tensor.std(dim=(0, 2, 3), keepdim=True)
        std = torch.clamp(std, min=1e-6)
        return mean, std

    def _to_color_space(self, t, color_space):
        if color_space == "LAB":
            return kornia.color.rgb_to_lab(t)
        if color_space == "YCbCr":
            return kornia.color.rgb_to_ycbcr(t)
        if color_space == "LUV":
            return kornia.color.rgb_to_luv(t)
        if color_space == "YUV":
            return kornia.color.rgb_to_yuv(t)
        if color_space == "XYZ":
            return kornia.color.rgb_to_xyz(t)
        return t

    def _from_color_space(self, t, color_space):
        if color_space == "LAB":
            return kornia.color.lab_to_rgb(t)
        if color_space == "YCbCr":
            return kornia.color.ycbcr_to_rgb(t)
        if color_space == "LUV":
            return kornia.color.luv_to_rgb(t)
        if color_space == "YUV":
            return kornia.color.yuv_to_rgb(t)
        if color_space == "XYZ":
            return kornia.color.xyz_to_rgb(t)
        return t


NODE_CLASS_MAPPINGS = {
    "AKMatchColor": AKMatchColor,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKMatchColor": "AK Match Color",
}
