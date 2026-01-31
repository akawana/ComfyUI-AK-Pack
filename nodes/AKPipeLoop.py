# AKPipeLoop.py

class AKPipeLoop:
    IDX_HASH = 0
    IDX_MODEL = 1
    IDX_CLIP = 2
    IDX_VAE = 3
    IDX_POS = 4
    IDX_NEG = 5
    IDX_LATENT = 6
    IDX_IMAGE = 7

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "pipe_in_1": ("AK_PIPE",),
            },
            "optional": {
                "pipe_in_2": ("AK_PIPE",),
                "pipe_in_3": ("AK_PIPE",),
                "pipe_in_4": ("AK_PIPE",),
                "pipe_in_5": ("AK_PIPE",),
                "pipe_in_6": ("AK_PIPE",),
                "pipe_in_7": ("AK_PIPE",),
                "pipe_in_8": ("AK_PIPE",),
                "pipe_in_9": ("AK_PIPE",),
                "pipe_in_10": ("AK_PIPE",),
            },
        }

    RETURN_TYPES = (
        "AK_PIPE",
        "MODEL",
        "CLIP",
        "VAE",
        "CONDITIONING",
        "CONDITIONING",
        "LATENT",
        "IMAGE",
    )

    RETURN_NAMES = (
        "pipe_out",
        "model",
        "clip",
        "vae",
        "positive",
        "negative",
        "latent",
        "image",
    )

    FUNCTION = "run"
    CATEGORY = "AK/pipe"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # Force this node to always re-run
        return float("nan")

    def __init__(self):
        # Stored hashes per input index (0..9 for pipe_in_1..pipe_in_10).
        self._stored_hashes = {}

    def _normalize_pipe(self, pipe):
        if pipe is None:
            return None

        if not isinstance(pipe, tuple):
            pipe = tuple(pipe)

        # Old format: 7-tuple without hash -> prepend None hash.
        if len(pipe) == 7:
            pipe = (None,) + pipe
        elif len(pipe) < 7:
            pipe = (None,) + pipe + (None,) * (7 - len(pipe))
        elif len(pipe) > 8:
            pipe = pipe[:8]

        return pipe

    def _get_hash_from_pipe(self, pipe):
        if pipe is None:
            return None
        if not isinstance(pipe, tuple):
            pipe = tuple(pipe)
        if len(pipe) == 0:
            return None
        # If it is old 7-tuple without hash, treat hash as None.
        if len(pipe) == 7:
            return None
        return pipe[self.IDX_HASH]

    def _outputs_from_pipe(self, pipe):
        # Assumes pipe is already normalized to at least 8 elements.
        model = pipe[self.IDX_MODEL]
        clip = pipe[self.IDX_CLIP]
        vae = pipe[self.IDX_VAE]
        positive = pipe[self.IDX_POS]
        negative = pipe[self.IDX_NEG]
        latent = pipe[self.IDX_LATENT]
        image = pipe[self.IDX_IMAGE]
        return (pipe, model, clip, vae, positive, negative, latent, image)

    def run(
        self,
        pipe_in_1,
        pipe_in_2=None,
        pipe_in_3=None,
        pipe_in_4=None,
        pipe_in_5=None,
        pipe_in_6=None,
        pipe_in_7=None,
        pipe_in_8=None,
        pipe_in_9=None,
        pipe_in_10=None,
    ):
        inputs = [
            pipe_in_1,
            pipe_in_2,
            pipe_in_3,
            pipe_in_4,
            pipe_in_5,
            pipe_in_6,
            pipe_in_7,
            pipe_in_8,
            pipe_in_9,
            pipe_in_10,
        ]

        current_hashes = {}
        changed_indices = []
        normalized_pipes = {}

        # First pass: compute hashes for all valid inputs and detect changes
        for idx, raw_pipe in enumerate(inputs):
            if raw_pipe is None:
                continue

            pipe = self._normalize_pipe(raw_pipe)
            if pipe is None:
                continue

            normalized_pipes[idx] = pipe
            h = self._get_hash_from_pipe(pipe)
            current_hashes[idx] = h

            prev = self._stored_hashes.get(idx, None)
            if idx not in self._stored_hashes or h != prev:
                changed_indices.append(idx)

        # Update stored hashes snapshot to current state
        self._stored_hashes = current_hashes

        # If there is at least one changed input, use the first one
        if changed_indices:
            first_idx = changed_indices[0]
            pipe = normalized_pipes[first_idx]
            return self._outputs_from_pipe(pipe)

        # No hashes changed: choose the last non-None current input
        last_pipe = None
        for raw_pipe in inputs:
            if raw_pipe is not None:
                p = self._normalize_pipe(raw_pipe)
                if p is not None:
                    last_pipe = p

        if last_pipe is not None:
            return self._outputs_from_pipe(last_pipe)

        # Degenerate empty outputs if nothing valid found
        return (None, None, None, None, None, None, None, None)


NODE_CLASS_MAPPINGS = {
    "AK Pipe Loop": AKPipeLoop,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Pipe Loop": "AK Pipe Loop",
}
