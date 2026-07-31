WEB_DIRECTORY = "./js"

import importlib

_NODE_MODULES = [
    "AKIndexMultiple",
    "AKCLIPEncodeMultiple",
    "AKIsOneOfGroupsActive",
    "RepeatGroupState",
    "PreviewRawText",
    "CLIPTextEncodeCached",
    "CLIPTextEncodeAndCombineCached",
    "AKBase",
    "AKPipe",
    "AKPipeLoop",
    "Setter",
    "Getter",
    "AKResizeOnBoolean",
    "IsMaskEmpty",
    "AKContrastAndSaturateImage",
    "AKReplaceAlphaWithColor",
    "AKReplaceColorWithAlpha",
    "AKControlMultipleKSamplers",
    "AKKSamplerSettings",
    "AKProjectSettingsOut",
    "AKMatchColor",
    "AKListLength",
    "AKMakeListFromAny",
    "AKSaveImageAndData",
    "AKClearPrompt",
]

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

for _mod_name in _NODE_MODULES:
    _mod = importlib.import_module(f".nodes.{_mod_name}", package=__name__)
    NODE_CLASS_MAPPINGS.update(_mod.NODE_CLASS_MAPPINGS)
    NODE_DISPLAY_NAME_MAPPINGS.update(_mod.NODE_DISPLAY_NAME_MAPPINGS)

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]