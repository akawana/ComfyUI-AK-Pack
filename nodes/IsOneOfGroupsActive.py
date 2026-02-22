import math

class IsOneOfGroupsActive:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "group_name_contains": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": False,
                    },
                ),
                "active_state": (
                    "BOOLEAN",
                    {
                        "default": False,
                    },
                ),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("boolean",)
    FUNCTION = "pass_state"
    CATEGORY = "AK/logic"

    @classmethod
    def IS_CHANGED(cls, group_name_contains, active_state):
        return float("nan")

    def pass_state(self, group_name_contains, active_state):
        return (active_state,)


NODE_CLASS_MAPPINGS = {
    "IsOneOfGroupsActive": IsOneOfGroupsActive,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "IsOneOfGroupsActive": "IsOneOfGroupsActive",
}
