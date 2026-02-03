import json
import io
import base64
import os

from PIL import Image
import numpy as np
import torch
import folder_paths


_GARBAGE_SUBFOLDER = "garbage"


def _is_under_dir(path: str, root: str) -> bool:
    try:
        path_abs = os.path.abspath(path)
        root_abs = os.path.abspath(root)
        return os.path.commonpath([path_abs, root_abs]) == root_abs
    except Exception:
        return False


def _safe_join_under(root: str, *parts: str) -> str:
    joined = os.path.abspath(os.path.join(root, *[str(p or "") for p in parts]))
    if not _is_under_dir(joined, root):
        return ""
    return joined


def _load_image_to_tensor(abs_path: str):
    img = Image.open(abs_path).convert("RGB")
    np_img = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(np_img)[None,]


def _find_first_subfolder_abs_path_by_filename(filename: str) -> str:
    if not filename:
        return ""

    input_dir_abs = os.path.abspath(folder_paths.get_input_directory())

    target = os.path.basename(str(filename)).strip()
    if not target:
        return ""

    target_l = target.lower()
    garbage_root = os.path.join(input_dir_abs, _GARBAGE_SUBFOLDER)

    for dirpath, dirnames, filenames in os.walk(input_dir_abs, topdown=False):
        dirpath_abs = os.path.abspath(dirpath)

        # ignore input root
        if dirpath_abs == input_dir_abs:
            continue

        # ignore /input/garbage/ (and any nested subfolders)
        if _is_under_dir(dirpath_abs, garbage_root):
            continue

        for fn in filenames:
            if str(fn).lower() == target_l:
                return os.path.join(dirpath_abs, "")

    return ""


class AKProjectSettingsOut:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ak_project_settings_json": ("STRING", {"default": "", "multiline": False}),
            }
        }

    RETURN_TYPES = (
        "STRING",
        "STRING",
        "INT",
        "INT",
        "BOOLEAN",
        "IMAGE",
        "STRING",
        "STRING",
    )

    RETURN_NAMES = (
        "output_filename",
        "output_subfolder",
        "width",
        "height",
        "do_resize",
        "image",
        "image_filename",
        "image_filepath",
    )

    FUNCTION = "run"
    CATEGORY = "AK/settings"
    DESCRIPTION = (
        "Outputs the values of fields defined in the Project Settings panel. "
        "Additionally, it can resolve and output the image file path for images "
        "located in ComfyUI’s native input directory, including nested subfolders."
    )

    def run(self, ak_project_settings_json):
        try:
            vals = json.loads(ak_project_settings_json or "{}")
        except Exception:
            vals = {}

        output_filename = str(vals.get("output_filename", ""))
        output_subfolder = str(vals.get("output_subfolder", ""))
        width = int(vals.get("width", 0) or 0)
        height = int(vals.get("height", 0) or 0)

        do_resize_raw = int(vals.get("do_resize", 0) or 0)
        do_resize = bool(do_resize_raw == 1)

        image = None

        open_image_filename = str(vals.get("open_image_filename") or "").strip()
        open_image_subfolder = str(vals.get("open_image_subfolder") or "").strip()
        open_image_type = str(vals.get("open_image_type") or "input").strip() or "input"

        image_filename = os.path.splitext(os.path.basename(open_image_filename))[0] if open_image_filename else ""

        # image_filepath: folder path (abs) where the file is found in input subfolders; ignore /input/garbage/
        image_filepath = ""
        try:
            if open_image_filename:
                image_filepath = _find_first_subfolder_abs_path_by_filename(open_image_filename) or ""
        except Exception:
            image_filepath = ""

        # Prefer loading by (filename, subfolder, type) from input directory
        if open_image_filename and open_image_type == "input":
            try:
                input_dir_abs = os.path.abspath(folder_paths.get_input_directory())
                abs_path = _safe_join_under(input_dir_abs, open_image_subfolder, open_image_filename)
                if abs_path and os.path.isfile(abs_path):
                    image = _load_image_to_tensor(abs_path)
            except Exception:
                image = None

        # Backward compatibility: if JSON still contains a data URL, try loading from it
        if image is None:
            image_data = vals.get("open_image", "")
            if isinstance(image_data, str) and image_data.startswith("data:image"):
                try:
                    _, b64 = image_data.split(",", 1)
                    raw = base64.b64decode(b64)
                    img = Image.open(io.BytesIO(raw)).convert("RGB")
                    np_img = np.array(img).astype(np.float32) / 255.0
                    image = torch.from_numpy(np_img)[None,]
                except Exception:
                    image = None

        return (
            output_filename,
            output_subfolder,
            width,
            height,
            do_resize,
            image,
            image_filename,
            image_filepath,
        )


NODE_CLASS_MAPPINGS = {
    "AKProjectSettingsOut": AKProjectSettingsOut
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKProjectSettingsOut": "AK Project Settings Out"
}
