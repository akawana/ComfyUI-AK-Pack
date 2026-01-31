class CLIPTextEncodeAndCombineCached:
    _last_text = None
    _last_encoded = None
    _last_clip_id = None

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip": ("CLIP",),
                "text": ("STRING", {"multiline": True, "default": ""}),
            },
            "optional": {
                "conditioning": ("CONDITIONING",),
            },
        }

    RETURN_TYPES = ("CONDITIONING",)
    RETURN_NAMES = ("conditioning",)
    FUNCTION = "execute"
    CATEGORY = "AK/conditioning"
    OUTPUT_NODE = False

    @classmethod
    def _normalize_text(cls, text):
        if text is None:
            return ""
        return str(text).replace("\r\n", "\n").replace("\r", "\n")

    @classmethod
    def _has_meaningful_text(cls, text):
        return bool(text and text.strip())

    @classmethod
    def _encode_cached(cls, clip, text):
        clip_id = id(clip)
        if cls._last_clip_id == clip_id and cls._last_text == text and cls._last_encoded is not None:
            return cls._last_encoded

        tokens = clip.tokenize(text)
        cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
        conditioning = [[cond, {"pooled_output": pooled}]]

        cls._last_clip_id = clip_id
        cls._last_text = text
        cls._last_encoded = conditioning

        return conditioning

    @classmethod
    def execute(cls, clip, text, conditioning=None):
        text = cls._normalize_text(text)

        if not cls._has_meaningful_text(text):
            if conditioning is not None:
                return (conditioning,)
            return ([],)

        new_cond = cls._encode_cached(clip, text)

        if conditioning is None:
            return (new_cond,)

        return (conditioning + new_cond,)


NODE_CLASS_MAPPINGS = {"CLIPTextEncodeAndCombineCached": CLIPTextEncodeAndCombineCached}
NODE_DISPLAY_NAME_MAPPINGS = {"CLIPTextEncodeAndCombineCached": "CLIP Text Encode & Combine (Cached)"}
