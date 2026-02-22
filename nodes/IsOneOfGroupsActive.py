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

    def _parse_group_contains_list(self, group_name_contains: str):
        """Parse a comma-separated list of group name fragments.

        Backward compatible:
        - Empty string => []
        - No comma => [trimmed string]
        - Comma-separated => list of trimmed non-empty parts
        """
        if not isinstance(group_name_contains, str):
            return []
        parts = [p.strip() for p in group_name_contains.split(",")]
        return [p for p in parts if p]

    def pass_state(self, group_name_contains, active_state):
        # NOTE:
        # This node historically acted as a simple boolean pass-through.
        # We keep that behavior intact, but also support a comma-separated list
        # in `group_name_contains`. If `active_state` arrives as an iterable of
        # booleans (e.g. one per group from upstream logic), we return True
        # if at least one item is True.
        _ = self._parse_group_contains_list(group_name_contains)

        # If upstream provides multiple boolean states, aggregate them.
        if isinstance(active_state, (list, tuple, set)):
            return (any(bool(x) for x in active_state),)

        return (bool(active_state),)


NODE_CLASS_MAPPINGS = {
    "IsOneOfGroupsActive": IsOneOfGroupsActive,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "IsOneOfGroupsActive": "IsOneOfGroupsActive",
}
