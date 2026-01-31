import zlib


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


ANY_TYPE = AnyType("*")


class CLIPEncodeMultiple:
    empty_cache = {}
    # text_cache = {}

    last_items = None
    idx_cache = {}
    hash_cache = {}

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "str_list": (ANY_TYPE, {"forceInput": False}),
                "clip": ("CLIP",),
                "starting_index": ("INT", {"default": 0, "min": 0, "step": 1}),
                "length": ("INT", {"default": 1, "min": 1, "max": 20, "step": 1}),
            },
            "optional": {
                "mask_list": ("MASK",),
            },
        }

    RETURN_TYPES = ("CONDITIONING",) + ("CONDITIONING",) * 20
    RETURN_NAMES = ("combined_con",) + tuple(f"cond_{i}" for i in range(20))

    FUNCTION = "execute"
    CATEGORY = "AK/conditioning"
    OUTPUT_NODE = False

    INPUT_IS_LIST = True

    @classmethod
    def _get_empty_cond(cls, clip):
        key = id(clip)
        cached = cls.empty_cache.get(key)
        if cached is not None:
            return cached

        tokens = clip.tokenize("")
        cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
        empty = [[cond, {"pooled_output": pooled}]]
        cls.empty_cache[key] = empty
        return empty

    @classmethod
    def _encode_text(cls, clip, text):
        tokens = clip.tokenize(text)
        cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
        return [[cond, {"pooled_output": pooled}]]

    @staticmethod
    def _clip_key(clip):
        inner = getattr(clip, "cond_stage_model", None)
        if inner is not None:
            return id(inner)
        inner = getattr(clip, "clip", None) or getattr(clip, "model", None)
        if inner is not None:
            return id(inner)
        return id(clip)

    @staticmethod
    def _apply_mask_to_cond(base_cond, mask):
        if mask is None:
            return base_cond
        cond_with_mask = []
        for t, data in base_cond:
            data_copy = dict(data) if data is not None else {}
            data_copy["mask"] = mask
            data_copy["mask_strength"] = 1.0
            cond_with_mask.append([t, data_copy])
        return cond_with_mask

    @classmethod
    def _compute_hash(cls, items, masks, start, length):
        max_bytes = 64 * 1024
        buf = bytearray()

        def add_bytes(b):
            nonlocal buf
            if not b:
                return
            remaining = max_bytes - len(buf)
            if remaining <= 0:
                return
            if len(b) > remaining:
                buf.extend(b[:remaining])
            else:
                buf.extend(b)

        for v in items:
            s = "" if v is None else v
            add_bytes(s.encode("utf-8", errors="ignore") + b"\n")
            if len(buf) >= max_bytes:
                break

        if len(buf) < max_bytes and masks:
            for m in masks:
                if m is None:
                    add_bytes(b"MNONE\n")
                else:
                    try:
                        t = m
                        if isinstance(t, (list, tuple)):
                            t = t[0]
                        if hasattr(t, "detach"):
                            t = t.detach()
                        arr = t.cpu().contiguous().numpy()
                        add_bytes(arr.tobytes())
                    except Exception:
                        add_bytes(repr(type(m)).encode("utf-8", errors="ignore"))
                if len(buf) >= max_bytes:
                    break

        add_bytes(f"|start={start}|len={length}".encode("ascii"))

        return zlib.adler32(bytes(buf)) & 0xFFFFFFFF

    def execute(self, clip, str_list, starting_index, length, mask_list=None):
        if isinstance(clip, (list, tuple)):
            clip_obj = clip[0]
        else:
            clip_obj = clip

        if isinstance(str_list, (list, tuple)):
            if len(str_list) == 1 and isinstance(str_list[0], (list, tuple)):
                items = list(str_list[0])
            else:
                items = list(str_list)
        else:
            items = [str_list]

        if not isinstance(items, list) or not all(
            (isinstance(v, str) or v is None) for v in items
        ):
            raise RuntimeError("Require array of strings")

        masks = []
        if mask_list is not None:
            if isinstance(mask_list, (list, tuple)):
                if len(mask_list) == 1 and isinstance(mask_list[0], (list, tuple)):
                    masks = list(mask_list[0])
                else:
                    masks = list(mask_list)
            else:
                masks = [mask_list]

        if isinstance(starting_index, (list, tuple)):
            start_raw = starting_index[0] if starting_index else 0
        else:
            start_raw = starting_index

        if isinstance(length, (list, tuple)):
            length_raw = length[0] if length else 1
        else:
            length_raw = length

        start = max(0, int(start_raw))
        length_val = max(1, min(20, int(length_raw)))

        if CLIPEncodeMultiple.last_items is None or len(CLIPEncodeMultiple.last_items) != len(items):
            CLIPEncodeMultiple.last_items = [None] * len(items)
            CLIPEncodeMultiple.idx_cache.clear()

        clip_id = self._clip_key(clip_obj)
        items_copy = list(items)
        masks_copy = list(masks) if masks else []
        hval = self._compute_hash(items_copy, masks_copy, start, length_val)
        cache_key = (clip_id, hval)

        cached_entry = CLIPEncodeMultiple.hash_cache.get(cache_key)
        if cached_entry is not None:
            combined_cached, per_idx_cached = cached_entry
            per_idx_cached = list(per_idx_cached)
            if len(per_idx_cached) < 20:
                per_idx_cached.extend([None] * (20 - len(per_idx_cached)))
            elif len(per_idx_cached) > 20:
                per_idx_cached = per_idx_cached[:20]
            return (combined_cached,) + tuple(per_idx_cached)

        result = []
        empty_cond = None
        combined_cond = None

        for i in range(length_val):
            idx = start + i

            cond = None
            if 0 <= idx < len(items):
                v = items[idx]

                mask_for_idx = None
                if 0 <= idx < len(masks):
                    mask_for_idx = masks[idx]

                if v is None:
                    if empty_cond is None:
                        empty_cond = self._get_empty_cond(clip_obj)
                    base_cond = empty_cond
                    CLIPEncodeMultiple.last_items[idx] = None
                else:
                    prev = CLIPEncodeMultiple.last_items[idx]
                    if v == prev:
                        cached = CLIPEncodeMultiple.idx_cache.get((clip_id, idx))
                        if cached is not None:
                            base_cond = cached
                        else:
                            base_cond = self._encode_text(clip_obj, v)
                            CLIPEncodeMultiple.idx_cache[(clip_id, idx)] = base_cond
                    else:
                        base_cond = self._encode_text(clip_obj, v)
                        CLIPEncodeMultiple.idx_cache[(clip_id, idx)] = base_cond
                        CLIPEncodeMultiple.last_items[idx] = v

                cond = self._apply_mask_to_cond(base_cond, mask_for_idx)
                if v is not None and cond is not None:
                    if combined_cond is None:
                        combined_cond = []
                    for t, data in cond:
                        data_copy = dict(data) if data is not None else {}
                        combined_cond.append([t, data_copy])

            result.append(cond)

        if length_val < 20:
            result.extend([None] * (20 - length_val))

        CLIPEncodeMultiple.hash_cache[cache_key] = (combined_cond, list(result))

        return (combined_cond,) + tuple(result)


NODE_CLASS_MAPPINGS = {"CLIPEncodeMultiple": CLIPEncodeMultiple}
NODE_DISPLAY_NAME_MAPPINGS = {"CLIPEncodeMultiple": "CLIP Encode Multiple"}
