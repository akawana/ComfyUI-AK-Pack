import os
import json
import base64
import io as io_module

import numpy as np
import torch
from PIL import Image
import folder_paths

from comfy_api.latest import ComfyExtension, io


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


def _find_first_subfolder_abs_path_by_filename(filename: str) -> str:
    """
    Returns the relative subfolder path inside the ComfyUI input directory.
    Examples:
        input/datasets/image.png           → "datasets/"
        input/datasets/hairy/image.png     → "datasets/hairy/"
        input/myproject/sub1/sub2/img.png  → "myproject/sub1/sub2/"
    """
    if not filename:
        return ""

    filename = str(filename).strip()
    if not filename:
        return ""

    input_dir = os.path.abspath(folder_paths.get_input_directory())

    for dirpath, _, filenames in os.walk(input_dir, topdown=True):
        for fn in filenames:
            if fn.lower() == filename.lower():
                abs_dirpath = os.path.abspath(dirpath)
                try:
                    rel_path = os.path.relpath(abs_dirpath, input_dir)
                    if rel_path == "." or rel_path == "":
                        return ""
                    rel_path = rel_path.replace("\\", "/")
                    return rel_path.rstrip("/") + "/" if rel_path else ""
                except Exception:
                    return ""

    return ""


class AKProjectSettingsOutImage(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="AKProjectSettingsOutImage",
            display_name="AK Project Settings Out Image",
            category="AK/settings",
            description=(
                "Outputs the opened image from the Project Settings panel, "
                "along with output filename and subfolder path."
            ),
            inputs=[
                io.String.Input(
                    "ak_project_settings_json",
                    default="",
                    multiline=False,
                    tooltip="JSON string from the AK Project Settings panel.",
                ),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
                io.String.Output(display_name="output_filename"),   # ← renamed
                io.String.Output(display_name="output_subfolder"),
            ],
        )

    @classmethod
    def execute(cls, ak_project_settings_json: str) -> io.NodeOutput:
        try:
            vals = json.loads(ak_project_settings_json or "{}")
        except Exception:
            vals = {}

        open_image_filename = str(vals.get("open_image_filename") or "").strip()
        open_image_subfolder = str(vals.get("open_image_subfolder") or "").strip()
        open_image_type = str(vals.get("open_image_type") or "input").strip() or "input"

        # === NEW LOGIC FOR output_filename ===
        output_filename = str(vals.get("output_filename") or "").strip()

        # If output_filename is empty or missing → fallback to open_image_filename (stem)
        if not output_filename and open_image_filename:
            output_filename = os.path.splitext(os.path.basename(open_image_filename))[0]

        # output_subfolder logic (unchanged)
        output_subfolder = str(vals.get("output_subfolder") or "").strip()

        if not output_subfolder and open_image_filename:
            try:
                detected = _find_first_subfolder_abs_path_by_filename(open_image_filename)
                if detected:
                    output_subfolder = detected
            except Exception:
                pass

        image = None

        if open_image_filename and open_image_type == "input":
            try:
                input_dir_abs = os.path.abspath(folder_paths.get_input_directory())
                abs_path = _safe_join_under(
                    input_dir_abs, open_image_subfolder, open_image_filename
                )
                if abs_path and os.path.isfile(abs_path):
                    img = Image.open(abs_path).convert("RGB")
                    np_img = np.array(img).astype(np.float32) / 255.0
                    image = torch.from_numpy(np_img)[None,]
            except Exception:
                image = None

        if image is None:
            image_data = vals.get("open_image", "")
            if isinstance(image_data, str) and image_data.startswith("data:image"):
                try:
                    _, b64 = image_data.split(",", 1)
                    raw = base64.b64decode(b64)
                    img = Image.open(io_module.BytesIO(raw)).convert("RGB")
                    np_img = np.array(img).astype(np.float32) / 255.0
                    image = torch.from_numpy(np_img)[None,]
                except Exception:
                    image = None

        return io.NodeOutput(image, output_filename, output_subfolder)


class AKProjectSettingsOutImageExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [AKProjectSettingsOutImage]


async def comfy_entrypoint() -> AKProjectSettingsOutImageExtension:
    return AKProjectSettingsOutImageExtension()


NODE_CLASS_MAPPINGS = {
    "AKProjectSettingsOutImage": AKProjectSettingsOutImage,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKProjectSettingsOutImage": "AK Project Settings Out Image",
}