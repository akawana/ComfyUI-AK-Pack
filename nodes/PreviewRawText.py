from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)


class PreviewRawText:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "text": ("STRING", {"forceInput": True}),
                "list_values": (
                    "LIST",
                    {
                        "element_type": "STRING",
                        "forceInput": True,
                    },
                ),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "notify"
    OUTPUT_NODE = True

    CATEGORY = "AK/utils"

    @staticmethod
    def _pretty_json_if_possible(value: str) -> str:
        if value is None:
            return ""
        s = value.strip()
        if not s:
            return value
        if s[0] not in "{[":
            return value
        try:
            obj = json.loads(s)
        except Exception:
            return value
        try:
            return json.dumps(obj, ensure_ascii=False, indent=2)
        except Exception:
            return value

    def notify(self, text=None, list_values=None, unique_id=None):
        base_text = "" if text is None else str(text)
        base_text = self._pretty_json_if_possible(base_text)

        def normalize_list_values(value):
            if value is None:
                return ""
            if not isinstance(value, list):
                v = "NONE" if value is None else str(value)
                return self._pretty_json_if_possible(v)

            lines = []

            for v in value:
                if isinstance(v, list):
                    for inner in v:
                        if inner is None:
                            lines.append("NONE")
                        else:
                            lines.append(self._pretty_json_if_possible(str(inner)))
                else:
                    if v is None:
                        lines.append("NONE")
                    else:
                        lines.append(self._pretty_json_if_possible(str(v)))

            return "\n\n".join(lines)

        list_text = normalize_list_values(list_values)

        if base_text and list_text:
            final_text = base_text + "\n\n" + list_text
        elif list_text:
            final_text = list_text
        else:
            final_text = base_text

        return {"ui": {"text": final_text}, "result": (final_text,)}


NODE_CLASS_MAPPINGS = {
    "PreviewRawText": PreviewRawText,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PreviewRawText": "Preview Raw Text",
}
