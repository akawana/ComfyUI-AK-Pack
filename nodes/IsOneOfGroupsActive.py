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
            # `active_state` is expected to be: { "<group title>": <bool active>, ... }
            tokens = [t.strip().lower() for t in str(group_name_contains).split(",") if t.strip()]

            # Backward-compatible: if no tokens provided, keep previous behavior (any group is active)
            if not tokens:
                return (any(bool(v) for v in active_state.values()),)

            # New behavior: if at least one matching group is active -> True
            for title, is_active in active_state.items():
                title_l = str(title).lower()
                if any(tok in title_l for tok in tokens) and bool(is_active):
                    return (True,)

            return (False,)
        
        if isinstance(active_state, (list, tuple, set)):
            return (any(bool(x) for x in active_state),)

        return (bool(active_state),)


NODE_CLASS_MAPPINGS = {
    "IsOneOfGroupsActive": IsOneOfGroupsActive,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "IsOneOfGroupsActive": "IsOneOfGroupsActive",
}
