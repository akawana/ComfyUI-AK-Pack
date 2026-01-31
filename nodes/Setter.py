import sys, types, bisect

_STORE_KEY = "ak_var_nodes_store"

class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

ANY_TYPE = AnyType("*")

def _get_store():
    st = sys.modules.get(_STORE_KEY)
    if st is None:
        st = types.SimpleNamespace(
            last_prompt_obj_id=None,
            allowed_ids_by_name={},
            values_by_name={},
            names_sorted=[],
            last_name_by_setter_id={}
        )
        sys.modules[_STORE_KEY] = st
    if not hasattr(st, "last_name_by_setter_id"):
        st.last_name_by_setter_id = {}
    return st

def _rebuild_from_prompt(st, prompt):
    st.allowed_ids_by_name.clear()
    st.names_sorted.clear()
    valid_names = set()

    try:
        if isinstance(prompt, dict):
            for node_id, node in prompt.items():
                if not isinstance(node, dict):
                    continue
                if node.get("class_type") != "Setter":
                    continue
                inputs = node.get("inputs") or {}
                name = inputs.get("var_name", "")
                if name is None:
                    name = ""
                if not isinstance(name, str):
                    name = str(name)
                name = name.strip()
                if not name:
                    continue

                sid = str(node_id)
                old_name = st.last_name_by_setter_id.get(sid)

                if old_name and old_name != name:
                    if name not in st.values_by_name:
                        v = st.values_by_name.get(old_name, None)
                        if v is not None:
                            st.values_by_name[name] = v
                    if old_name in st.values_by_name and old_name != name:
                        del st.values_by_name[old_name]

                st.last_name_by_setter_id[sid] = name

                valid_names.add(name)
                if name not in st.allowed_ids_by_name:
                    st.allowed_ids_by_name[name] = sid
                    if name not in st.values_by_name:
                        st.values_by_name[name] = None
                    bisect.insort(st.names_sorted, name)

        for k in list(st.values_by_name.keys()):
            if k not in valid_names:
                del st.values_by_name[k]

        for sid, nm in list(st.last_name_by_setter_id.items()):
            if nm not in valid_names:
                del st.last_name_by_setter_id[sid]
    except Exception:
        st.allowed_ids_by_name.clear()
        st.names_sorted.clear()

class Setter:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "obj": (ANY_TYPE,),
                "var_name": ("STRING", {"default": ""}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = (ANY_TYPE,)
    RETURN_NAMES = ("OUT",)
    FUNCTION = "set"
    OUTPUT_NODE = True
    CATEGORY = "AK/pipe"

    def set(self, obj, var_name, prompt=None, unique_id=None):
        st = _get_store()

        pid = None
        try:
            pid = id(prompt)
        except Exception:
            pid = None

        if pid is not None and pid != st.last_prompt_obj_id:
            st.last_prompt_obj_id = pid
            _rebuild_from_prompt(st, prompt)

        if var_name is None:
            var_name = ""
        if not isinstance(var_name, str):
            var_name = str(var_name)
        name = var_name.strip()
        if not name:
            raise Exception(f"[Setter {unique_id}] var_name is empty")

        if name not in st.allowed_ids_by_name:
            st.allowed_ids_by_name[name] = str(unique_id)
            st.values_by_name[name] = None
            bisect.insort(st.names_sorted, name)

        # value = obj[0] if isinstance(obj, (list, tuple)) else obj
        value = obj
        st.values_by_name[name] = value
        return (value,)

NODE_CLASS_MAPPINGS = {
    "Setter": Setter,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "Setter": "Setter",
}
