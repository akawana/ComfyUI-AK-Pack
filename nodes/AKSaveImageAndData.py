import os
import re

import numpy as np
from PIL import Image
import folder_paths

from comfy_api.latest import ComfyExtension, io


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


def _tensor_to_pil(tensor) -> Image.Image:
    """Convert a ComfyUI image tensor (B,H,W,C) float32 0..1 to PIL RGB."""
    arr = tensor[0].cpu().numpy()
    arr = (arr * 255.0).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def _resolve_filename(
    filename: str,       # stem from connected input (may be "")
    postfix: str,        # widget value (may be "")
    save_dir: str,       # absolute directory where we will save
) -> str:
    """
    Return the final stem (no extension) to use for saving.

    Rules:
      - filename given,  postfix given  →  "{filename}-{postfix_with_counter}"
      - filename missing, postfix given →  "{postfix_with_counter}"
      - filename given,  postfix empty  →  "{filename}"  (overwrites every run)
      - filename missing, postfix empty →  "{counter:03d}"
    """
    postfix = postfix.strip()
    filename = filename.strip() if filename else ""

    has_filename = bool(filename)
    has_postfix  = bool(postfix)

    if not has_filename and not has_postfix:
        # pure numeric counter: 001, 002, …
        counter = _next_counter_numeric(save_dir)
        return f"{counter:03d}"

    if has_filename and not has_postfix:
        # fixed name — will overwrite
        return filename

    # postfix contains #-sequences → replace with zero-padded counter
    # find the number of hashes in the longest run of # in postfix
    hash_groups = re.findall(r"#+", postfix)
    if hash_groups:
        pad = max(len(g) for g in hash_groups)
        counter = _next_counter_postfix(save_dir, filename, postfix, pad)
        padded = str(counter).zfill(pad)
        # replace ALL runs of # with the same padded number
        resolved_postfix = re.sub(r"#+", padded, postfix)
    else:
        # no hashes → append a simple 4-digit counter
        counter = _next_counter_postfix(save_dir, filename, postfix, 4)
        resolved_postfix = f"{postfix}{counter:04d}"

    if has_filename:
        return f"{filename}-{resolved_postfix}"
    else:
        return resolved_postfix


def _existing_stems(directory: str) -> set:
    """Return set of stems (no ext) of all files in directory."""
    if not os.path.isdir(directory):
        return set()
    stems = set()
    for f in os.listdir(directory):
        stem, _ = os.path.splitext(f)
        stems.add(stem)
    return stems


def _next_counter_numeric(save_dir: str) -> int:
    stems = _existing_stems(save_dir)
    i = 1
    while True:
        candidate = f"{i:03d}"
        if candidate not in stems:
            return i
        i += 1


def _next_counter_postfix(
    save_dir: str,
    filename_prefix: str,
    postfix_template: str,
    pad: int,
) -> int:
    stems = _existing_stems(save_dir)
    i = 1
    while True:
        padded = str(i).zfill(pad)
        resolved = re.sub(r"#+", padded, postfix_template) if "#" in postfix_template else f"{postfix_template}{padded}"
        if filename_prefix:
            candidate = f"{filename_prefix}-{resolved}"
        else:
            candidate = resolved
        if candidate not in stems:
            return i
        i += 1


class AKSaveImageAndData(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="AKSaveImageAndData",
            display_name="AK Save Image And Data",
            category="AK/io",
            is_output_node=True,
            description=(
                "Saves a PNG image (and optionally a .txt sidecar) to the output folder. "
                "Supports dynamic filenames with counter patterns (###). "
                "If 'original' is connected, also saves a side-by-side before/after composite."
            ),
            inputs=[
                io.Image.Input("image", tooltip="Image to save."),
                io.String.Input(
                    "filename",
                    default="",
                    multiline=False,
                    force_input=True,
                    optional=True,
                    tooltip="Base filename stem. If empty, only filename_postfix is used.",
                ),
                io.String.Input(
                    "txt",
                    default="",
                    multiline=True,
                    force_input=True,
                    optional=True,
                    tooltip="If connected, saved as a .txt file alongside the image.",
                ),
                io.Image.Input(
                    "original",
                    optional=True,
                    tooltip="If connected, a side-by-side before/after PNG is saved to subfolder/before_after/.",
                ),
                io.String.Input(
                    "subfolder",
                    default="",
                    multiline=False,
                    tooltip="Optional subfolder inside the output directory.",
                ),
                io.String.Input(
                    "filename_postfix",
                    default="###",
                    multiline=False,
                    tooltip=(
                        "Postfix appended to filename with a dash. "
                        "# characters are replaced by a zero-padded counter. "
                        "Leave empty to use filename as-is (overwrites)."
                    ),
                ),
            ],
            outputs=[],
        )

    @classmethod
    def execute(
        cls,
        image,
        filename: str = "",
        txt: str = "",
        original=None,
        subfolder: str = "",
        filename_postfix: str = "###",
    ) -> io.NodeOutput:

        output_root = os.path.abspath(folder_paths.get_output_directory())

        # ── resolve save directory ───────────────────────────────────────────
        subfolder = (subfolder or "").strip()
        if subfolder:
            save_dir = _safe_join_under(output_root, subfolder)
            if not save_dir:
                save_dir = output_root   # path traversal guard
        else:
            save_dir = output_root

        os.makedirs(save_dir, exist_ok=True)

        # ── resolve final stem ───────────────────────────────────────────────
        stem = _resolve_filename(
            filename=(filename or "").strip(),
            postfix=(filename_postfix or "").strip(),
            save_dir=save_dir,
        )

        # ── save main image ──────────────────────────────────────────────────
        img_pil = _tensor_to_pil(image)
        img_path = os.path.join(save_dir, f"{stem}.png")
        img_pil.save(img_path, format="PNG")

        # ── save txt sidecar ─────────────────────────────────────────────────
        if txt and txt.strip():
            txt_path = os.path.join(save_dir, f"{stem}.txt")
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(txt)

        # ── save before/after composite ──────────────────────────────────────
        if original is not None:
            orig_pil = _tensor_to_pil(original)

            # resize original to match image height if needed
            if orig_pil.height != img_pil.height:
                ratio = img_pil.height / orig_pil.height
                new_w = max(1, int(orig_pil.width * ratio))
                orig_pil = orig_pil.resize((new_w, img_pil.height), Image.LANCZOS)

            composite_w = orig_pil.width + img_pil.width
            composite_h = img_pil.height
            composite = Image.new("RGB", (composite_w, composite_h))
            composite.paste(orig_pil, (0, 0))
            composite.paste(img_pil, (orig_pil.width, 0))

            ba_dir_name = "before_after"
            if subfolder:
                ba_dir = _safe_join_under(output_root, subfolder, ba_dir_name)
                if not ba_dir:
                    ba_dir = os.path.join(output_root, ba_dir_name)
            else:
                ba_dir = os.path.join(output_root, ba_dir_name)

            os.makedirs(ba_dir, exist_ok=True)
            ba_path = os.path.join(ba_dir, f"{stem}.png")
            composite.save(ba_path, format="PNG")

        return io.NodeOutput()


class AKSaveImageAndDataExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [AKSaveImageAndData]


async def comfy_entrypoint() -> AKSaveImageAndDataExtension:
    return AKSaveImageAndDataExtension()


NODE_CLASS_MAPPINGS = {
    "AKSaveImageAndData": AKSaveImageAndData,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AKSaveImageAndData": "AK Save Image And Data",
}