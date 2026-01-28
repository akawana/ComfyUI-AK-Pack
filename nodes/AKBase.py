
# === AKXZ embedded JSON fallback (read from IMAGE tensors) ===
import json as _akxz_json
import torch as _akxz_torch

_AKXZ_MAGIC = b"AKXZ"
_AKXZ_HEADER_LEN = 8

def _akxz_float01_to_bytes(x: _akxz_torch.Tensor) -> bytes:
    x = _akxz_torch.clamp(x * 255.0 + 0.5, 0, 255).to(_akxz_torch.uint8).cpu()
    return x.numpy().tobytes()

def akxz_extract_image_cfg_list(images: _akxz_torch.Tensor):
    if not isinstance(images, _akxz_torch.Tensor) or images.ndim != 4:
        return []
    b = int(images.shape[0])
    out = []
    for i in range(b):
        row = images[i, 0, :, :3].reshape(-1)
        raw = _akxz_float01_to_bytes(row)
        if len(raw) < _AKXZ_HEADER_LEN or raw[:4] != _AKXZ_MAGIC:
            continue
        size = int.from_bytes(raw[4:8], "big")
        if size <= 0 or (8 + size) > len(raw):
            continue
        payload = raw[8:8+size]
        try:
            obj = _akxz_json.loads(payload.decode("utf-8"))
            if isinstance(obj, dict):
                out.append(obj)
        except Exception:
            pass
    return out


import os
import json

import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo

import folder_paths


AKBASE_STATE_FILENAME = "ak_base_state.json"
AKBASE_XZ_CONFIG_FILENAME = "ak_base_xz_config.json"

AKBASE_A_FILENAME = "ak_base_image_a.png"
AKBASE_B_FILENAME = "ak_base_image_b.png"

AKBASE_GALLERY_PREFIX = "ak_base_image_xy_"
AKBASE_GALLERY_MAX = 512


def _tensor_to_pil(img_tensor):
    arr = img_tensor.detach().cpu().numpy()
    arr = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def _temp_dir():
    d = folder_paths.get_temp_directory()
    os.makedirs(d, exist_ok=True)
    return d


def _temp_path(filename: str) -> str:
    return os.path.join(_temp_dir(), filename)


def _save_temp_png(img_tensor, filename: str, meta: dict = None) -> None:
    img = _tensor_to_pil(img_tensor)

    pnginfo = None
    if isinstance(meta, dict) and meta:
        pnginfo = PngInfo()
        for k, v in meta.items():
            if v is None:
                v = ""
            pnginfo.add_text(str(k), str(v))

    img.save(_temp_path(filename), compress_level=4, pnginfo=pnginfo)

def _safe_remove(filename: str) -> None:
    try:
        p = _temp_path(filename)
        if os.path.isfile(p):
            os.remove(p)
    except Exception:
        pass


def _clear_gallery_files() -> None:
    d = _temp_dir()
    for fn in os.listdir(d):
        if fn.startswith(AKBASE_GALLERY_PREFIX) and fn.lower().endswith(".png"):
            try:
                os.remove(os.path.join(d, fn))
            except Exception:
                pass


def _clear_compare_files() -> None:
    _safe_remove(AKBASE_A_FILENAME)
    _safe_remove(AKBASE_B_FILENAME)


def _write_state(state: dict, filename: str = None) -> None:
    try:
        fn = filename if filename else AKBASE_STATE_FILENAME
        with open(_temp_path(fn), "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False)
    except Exception:
        pass


class AKBase:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a_image": ("IMAGE",),
            },
            "optional": {
                "b_image": ("IMAGE",),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    CATEGORY = "AK/_testing_"
    OUTPUT_NODE = True

    def run(
        self,
        a_image,
        b_image=None,
        # ak_settings: str = None,
        unique_id=None,
    ):
        a_n = int(a_image.shape[0]) if hasattr(a_image, "shape") else 1
        b_n = int(b_image.shape[0]) if (b_image is not None and hasattr(b_image, "shape")) else 0

        ak_base_config = "{}"

        node_id = unique_id if unique_id is not None else getattr(self, "node_id", None)
        node_id = str(node_id) if node_id is not None else None
        suffix = f"_{node_id}" if node_id is not None else ""


        xz_fname = f"ak_base_xz_config{suffix}.json" if suffix else AKBASE_XZ_CONFIG_FILENAME
        try:

            content = "{}"
            cfg_list = []
            try:
                if (a_n > 1) or (b_n > 1):
                    imgs = []
                    if a_n > 1:
                        imgs.extend([a_image[i] for i in range(min(a_n, AKBASE_GALLERY_MAX))])
                    if b_n > 1 and b_image is not None:
                        remaining = AKBASE_GALLERY_MAX - len(imgs)
                        if remaining > 0:
                            imgs.extend([b_image[i] for i in range(min(b_n, remaining))])
                    if imgs:
                        cfg_list = akxz_extract_image_cfg_list(_akxz_torch.stack(imgs, dim=0))
                else:
                    cfg_list = akxz_extract_image_cfg_list(a_image)
            except Exception:
                cfg_list = []

            if cfg_list:
                content = json.dumps({"image": cfg_list}, ensure_ascii=False)
            with open(_temp_path(xz_fname), "w", encoding="utf-8") as f:
                f.write(content)

        except Exception:
            pass

        if a_n > 1 or b_n > 1:
            _clear_compare_files()
            if suffix:
                _safe_remove(f"ak_base_image_a{suffix}.png")
                _safe_remove(f"ak_base_image_b{suffix}.png")
            _clear_gallery_files()

            _save_temp_png(a_image[0], f"ak_base_image_a{suffix}.png" if suffix else AKBASE_A_FILENAME)
            if b_image is None:
                _save_temp_png(a_image[0], f"ak_base_image_b{suffix}.png" if suffix else AKBASE_B_FILENAME)
            else:
                _save_temp_png(b_image[0], f"ak_base_image_b{suffix}.png" if suffix else AKBASE_B_FILENAME)

            imgs = []
            if a_n > 1:
                imgs.extend([a_image[i] for i in range(min(a_n, AKBASE_GALLERY_MAX))])

            if b_n > 1 and b_image is not None:
                remaining = AKBASE_GALLERY_MAX - len(imgs)
                if remaining > 0:
                    imgs.extend([b_image[i] for i in range(min(b_n, remaining))])

            gallery_prefix = f"{AKBASE_GALLERY_PREFIX}{node_id}_" if node_id is not None else AKBASE_GALLERY_PREFIX
            for i, t in enumerate(imgs):
                _save_temp_png(t, f"{gallery_prefix}{i}.png")

            _write_state(
                {
                    "mode": "gallery",
                    "count": len(imgs),
                    "gallery_prefix": gallery_prefix,
                },
                filename=(f"ak_base_state{suffix}.json" if suffix else AKBASE_STATE_FILENAME),
            )

            return {"ui": {"ak_base_saved": [True]}, "result": (ak_base_config,)}

        _clear_gallery_files()
        if suffix:
            _safe_remove(f"ak_base_image_a{suffix}.png")
            _safe_remove(f"ak_base_image_b{suffix}.png")

        _save_temp_png(a_image[0], f"ak_base_image_a{suffix}.png" if suffix else AKBASE_A_FILENAME)

        if b_image is None:
            _save_temp_png(a_image[0], f"ak_base_image_b{suffix}.png" if suffix else AKBASE_B_FILENAME)
        else:
            _save_temp_png(b_image[0], f"ak_base_image_b{suffix}.png" if suffix else AKBASE_B_FILENAME)

        _write_state(
            {
                "mode": "compare",
                "a": {"filename": (f"ak_base_image_a{suffix}.png" if suffix else AKBASE_A_FILENAME), "type": "temp", "subfolder": ""},
                "b": {"filename": (f"ak_base_image_b{suffix}.png" if suffix else AKBASE_B_FILENAME), "type": "temp", "subfolder": ""},
                "preview_width": 512,
                "preview_height": 512,
            },
            filename=(f"ak_base_state{suffix}.json" if suffix else AKBASE_STATE_FILENAME),
        )

        return {"ui": {"ak_base_saved": [True]}, "result": (ak_base_config,)}


NODE_CLASS_MAPPINGS = {"AK Base": AKBase}
NODE_DISPLAY_NAME_MAPPINGS = {"AK Base": "AK Base"}
