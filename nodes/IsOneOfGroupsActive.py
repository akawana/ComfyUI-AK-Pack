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
            },
        }

    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("boolean",)
    FUNCTION = "pass_state"
    CATEGORY = "AK/logic"

    @classmethod
    def IS_CHANGED(cls, group_name_contains, active_state):
        return float("nan")

    def pass_state(self, group_name_contains, active_state):
        # Backward compatible behavior:
        # Historically this node was a simple pass-through for `active_state`.
        #
        # Extension:
        # If some upstream logic provides `active_state` as a list/tuple/set (e.g. one boolean per group),
        # then return True if at least one element is True.
        if isinstance(active_state, dict):
            return (any(bool(v) for v in active_state.values()),)

        if isinstance(active_state, (list, tuple, set)):
            return (any(bool(x) for x in active_state),)

        return (bool(active_state),)


NODE_CLASS_MAPPINGS = {
    "IsOneOfGroupsActive": IsOneOfGroupsActive,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "IsOneOfGroupsActive": "IsOneOfGroupsActive",
}
