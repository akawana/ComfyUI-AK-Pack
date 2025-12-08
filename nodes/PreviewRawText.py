from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class PreviewRawText:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                # Обычный текст, можно не подключать
                "text": ("STRING", {"forceInput": True}),
                # Список строк: LIST[STRING], можно не подключать
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
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    # НИЧЕГО листового:
    # INPUT_IS_LIST = True  <-- убираем
    RETURN_TYPES = ("STRING",)
    FUNCTION = "notify"
    OUTPUT_NODE = True
    # OUTPUT_IS_LIST = (True,)  <-- убираем, будет обычный STRING

    CATEGORY = "utils"

    def notify(self, text=None, list_values=None, unique_id=None, extra_pnginfo=None):
        # ---------- 1. Обычный текст с входа text ----------
        base_text = "" if text is None else str(text)

        # ---------- 2. Собираем строки из list_values ----------
        def normalize_list_values(value):
            if value is None:
                return ""

            # Ожидаем LIST[STRING] или LIST[LIST[STRING]]
            if not isinstance(value, list):
                # На всякий случай, если пришло что-то одно
                return "NONE" if value is None else str(value)

            lines = []

            for v in value:
                if isinstance(v, list):
                    # Один уровень вложенности: [ ["a", "b"], ["c"] ]
                    for inner in v:
                        if inner is None:
                            lines.append("NONE")
                        else:
                            lines.append(str(inner))
                else:
                    if v is None:
                        lines.append("NONE")
                    else:
                        lines.append(str(v))

            return "\n\n".join(lines)

        list_text = normalize_list_values(list_values)

        # ---------- 3. Склеиваем оба текста ----------
        if base_text and list_text:
            final_text = base_text + "\n\n" + list_text
        elif list_text:
            final_text = list_text
        else:
            final_text = base_text

        # ---------- 4. Сохраняем в workflow, как раньше ----------
        if unique_id is not None and extra_pnginfo is not None:
            if not isinstance(extra_pnginfo, list):
                logger.warning("Error: extra_pnginfo is not a list")
            elif (
                not isinstance(extra_pnginfo[0], dict)
                or "workflow" not in extra_pnginfo[0]
            ):
                logger.warning(
                    "Error: extra_pnginfo[0] is not a dict or missing 'workflow' key"
                )
            else:
                workflow = extra_pnginfo[0]["workflow"]
                node = next(
                    (
                        x
                        for x in workflow["nodes"]
                        if str(x["id"]) == str(unique_id[0])
                    ),
                    None,
                )
                if node:
                    node["widgets_values"] = [final_text]

        # ВАЖНО: возвращаем ОДИН STRING, а не список
        return {"ui": {"text": final_text}, "result": (final_text,)}


NODE_CLASS_MAPPINGS = {
    "PreviewRawText": PreviewRawText,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PreviewRawText": "Preview Raw Text",
}
