const AKXZ_DEBUG = true;

const ORIGINAL_LOG = console.log;
const ORIGINAL_WARN = console.warn;
const ORIGINAL_ERROR = console.error;
const ORIGINAL_INFO = console.info;

const SILENT_FILES = [
    "CLIPEncodeMultiple.js",
    "IndexMultiple.js",
    "IsOneOfGroupsActive.js",
    "PreviewRawText.js",
    "RepeatGroupState.js",
    "AKBaseSettings.js",
    "AKBase.js",
    "AKBase_io.js",
    "AKBase_input.js",
    "AKBase_ui.js",
    "AKVarNodes.js"
];

console.log = function (...args) {
    if (_akShouldSilence()) return;
    ORIGINAL_LOG.apply(console, args);
};

console.warn = function (...args) {
    if (_akShouldSilence()) return;
    ORIGINAL_WARN.apply(console, args);
};

// console.error = function (...args) {
//     if (_akShouldSilence()) return;
//     ORIGINAL_ERROR.apply(console, args);
// };

console.info = function (...args) {
    if (_akShouldSilence()) return;
    ORIGINAL_INFO.apply(console, args);
};

function _akShouldSilence() {
    if (AKXZ_DEBUG) return false;

    const stack = new Error().stack || "";
    for (const file of SILENT_FILES) {
        if (stack.includes(file)) {
            return true;
        }
    }
    return false;
}