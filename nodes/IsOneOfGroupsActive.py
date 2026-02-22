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
            "hidden": {
                # Provided by ComfyUI at execution time; used to inspect workflow groups.
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("boolean",)
    FUNCTION = "pass_state"
    CATEGORY = "AK/logic"

    @classmethod
    def IS_CHANGED(cls, group_name_contains, active_state, extra_pnginfo=None):
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

    def _iter_workflow_groups(self, extra_pnginfo):
        """Yield workflow group dicts from EXTRA_PNGINFO if present."""
        if not isinstance(extra_pnginfo, dict):
            return
        wf = extra_pnginfo.get("workflow")
        if not isinstance(wf, dict):
            return
        groups = wf.get("groups")
        if not isinstance(groups, list):
            return
        for g in groups:
            if isinstance(g, dict):
                yield g

    def _get_group_title(self, group_dict: dict):
        """Return a group's title/name string in a tolerant way."""
        for k in ("title", "name", "label"):
            v = group_dict.get(k)
            if isinstance(v, str) and v.strip():
                return v
        return ""

    def _is_group_marked_disabled(self, group_dict: dict):
        """Try to read an explicit disabled flag on a group if it exists.

        Different front-end extensions may store this field under different names.
        """
        for k in ("disabled", "is_disabled", "isDisabled", "muted", "is_muted", "bypassed", "is_bypassed"):
            if k in group_dict:
                return bool(group_dict.get(k))
        return None  # Unknown

    def _build_node_mode_map(self, extra_pnginfo):
        """Build {node_id: mode} map from workflow nodes if present."""
        if not isinstance(extra_pnginfo, dict):
            return {}
        wf = extra_pnginfo.get("workflow")
        if not isinstance(wf, dict):
            return {}
        nodes = wf.get("nodes")
        if not isinstance(nodes, list):
            return {}
        out = {}
        for n in nodes:
            if not isinstance(n, dict):
                continue
            nid = n.get("id")
            mode = n.get("mode")
            if isinstance(nid, int):
                out[nid] = mode
            elif isinstance(nid, str) and nid.isdigit():
                out[int(nid)] = mode
        return out

    def _group_node_ids(self, group_dict: dict):
        """Return a list of node ids that belong to a group, if available."""
        for k in ("nodes", "node_ids", "nodeIds"):
            v = group_dict.get(k)
            if isinstance(v, list):
                ids = []
                for x in v:
                    if isinstance(x, int):
                        ids.append(x)
                    elif isinstance(x, str) and x.isdigit():
                        ids.append(int(x))
                return ids
        return []

    def _is_group_active(self, group_dict: dict, node_mode_map: dict):
        """Determine whether a group is active.

        Priority:
        1) If the group has an explicit disabled flag (from some UI extension), use it.
        2) Otherwise, infer by checking whether the group contains at least one node
           with mode == 0 (normal/active).
        """
        disabled = self._is_group_marked_disabled(group_dict)
        if disabled is not None:
            return not disabled

        node_ids = self._group_node_ids(group_dict)
        if not node_ids:
            return False

        # ComfyUI/LiteGraph typically uses mode == 0 for normal execution.
        for nid in node_ids:
            if node_mode_map.get(nid, 0) == 0:
                return True
        return False

    def pass_state(self, group_name_contains, active_state, extra_pnginfo=None):
        # If EXTRA_PNGINFO is available, compute the result from workflow groups.
        # Otherwise, keep the historical pass-through behavior based on active_state.
        tokens = self._parse_group_contains_list(group_name_contains)

        # Backward compatible: the original widget semantics were "contains" (substring match).
        # Now we support a comma-separated list, where each item is also matched by substring.
        if extra_pnginfo is not None and tokens:
            node_mode_map = self._build_node_mode_map(extra_pnginfo)

            matched_any_group = False

            # If at least one token matches at least one active group -> True.
            for g in self._iter_workflow_groups(extra_pnginfo):
                title = self._get_group_title(g)
                if not title:
                    continue

                title_l = title.lower()

                for t in tokens:
                    t_l = t.lower()
                    if not t_l:
                        continue

                    if t_l in title_l:
                        matched_any_group = True
                        if self._is_group_active(g, node_mode_map):
                            return (True,)

            # If we matched at least one group but none are active -> False.
            if matched_any_group:
                return (False,)

            # If no group matched at all, preserve the old fallback behavior.
            # (Historically this node could act as a simple pass-through for active_state.)
            # Fall through to the old logic below.

        # Fallback: preserve old logic.
        if isinstance(active_state, (list, tuple, set)):
            return (any(bool(x) for x in active_state),)

        return (bool(active_state),)


NODE_CLASS_MAPPINGS = {
    "IsOneOfGroupsActive": IsOneOfGroupsActive,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "IsOneOfGroupsActive": "IsOneOfGroupsActive",
}
