class CLIPTextEncodeCached:
    # Runtime cache: text_hash -> conditioning
    _last_text = None
    _last_cond = None
    _last_clip_id = None

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip": ("CLIP",),
                "text": (
                    "STRING",
                    {"multiline": True, "default": "", "forceInput": True},
                ),
            }
        }

    RETURN_TYPES = ("CONDITIONING",)
    RETURN_NAMES = ("conditioning",)
    FUNCTION = "execute"
    CATEGORY = "conditioning"
    OUTPUT_NODE = False

    @classmethod
    def execute(cls, clip, text):
        if text is None:
            text = ""

        text = text.replace("\r\n", "\n").replace("\r", "\n")

        clip_id = id(clip)

        if cls._last_clip_id == clip_id and cls._last_text == text and cls._last_cond is not None:
            return (cls._last_cond,)

        tokens = clip.tokenize(text)
        cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
        conditioning = [[cond, {"pooled_output": pooled}]]

        cls._last_clip_id = clip_id
        cls._last_text = text
        cls._last_cond = conditioning

        return (conditioning,)


NODE_CLASS_MAPPINGS = {"CLIPTextEncodeCached": CLIPTextEncodeCached}

NODE_DISPLAY_NAME_MAPPINGS = {"CLIPTextEncodeCached": "CLIP Text Encode (Cached)"}
