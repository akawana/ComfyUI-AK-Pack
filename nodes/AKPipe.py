# AKPipe.py (patched with hash support)

class AKPipe:
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
            "required": {},
            "optional": {
                "pipe_in": ("AK_PIPE",),
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "vae": ("VAE",),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "latent": ("LATENT",),
                "image": ("IMAGE",),
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

    def _hash_object(self, obj):
        """Fast, small fingerprint of an object based on its repr, capped to 64KB."""
        try:
            s = repr(obj)
        except Exception:
            s = f"<obj {type(obj).__name__}>"
        b = s.encode("utf-8", errors="ignore")
        if len(b) > 65536:
            b = b[:65536]
        # built-in hash is fast and good enough within a single process
        return hash(b)

    def _combine_hashes(self, hashes):
        """Combine multiple integer hashes into a single hash value."""
        return hash(tuple(hashes))

    def _initial_hash_from_node(self):
        """Generate an initial hash value based on this node instance."""
        # fastest simple thing that is still somewhat unique per node instance
        return hash(("AKPipe", id(self)))

    def _normalize_pipe(self, pipe_in):
        """Normalize incoming pipe to (hash, model, clip, vae, pos, neg, latent, image)."""
        if pipe_in is None:
            return None

        if isinstance(pipe_in, tuple):
            pipe = pipe_in
        else:
            pipe = tuple(pipe_in)

        # Old-format compatibility: 7-tuple without hash -> prepend None hash.
        if len(pipe) == 7:
            pipe = (None,) + pipe
        elif len(pipe) < 7:
            # Very old/invalid, pad as best as we can.
            pipe = (None,) + pipe + (None,) * (7 - len(pipe))
        elif len(pipe) > 8:
            # Ignore anything beyond expected 8 fields.
            pipe = pipe[:8]

        return pipe

    def run(
        self,
        pipe_in=None,
        model=None,
        clip=None,
        vae=None,
        positive=None,
        negative=None,
        latent=None,
        image=None,
    ):
        # Normalize incoming pipe (may be None or old/new format).
        pipe = self._normalize_pipe(pipe_in)

        # Start from existing pipe or create a fresh one.
        if pipe is None:
            # New pipe: hash is None for now, rest from inputs.
            out = [
                None,
                model,
                clip,
                vae,
                positive,
                negative,
                latent,
                image,
            ]
        else:
            # Existing pipe: start from previous values.
            out = list(pipe)
            if len(out) < 8:
                out.extend([None] * (8 - len(out)))

            # Override with any non-None inputs.
            if model is not None:
                out[self.IDX_MODEL] = model
            if clip is not None:
                out[self.IDX_CLIP] = clip
            if vae is not None:
                out[self.IDX_VAE] = vae
            if positive is not None:
                out[self.IDX_POS] = positive
            if negative is not None:
                out[self.IDX_NEG] = negative
            if latent is not None:
                out[self.IDX_LATENT] = latent
            if image is not None:
                out[self.IDX_IMAGE] = image

        # Determine which new objects actually came in on this call (excluding pipe_in).
        hash_parts = []
        if model is not None:
            hash_parts.append(self._hash_object(model))
        if clip is not None:
            hash_parts.append(self._hash_object(clip))
        if vae is not None:
            hash_parts.append(self._hash_object(vae))
        if positive is not None:
            hash_parts.append(self._hash_object(positive))
        if negative is not None:
            hash_parts.append(self._hash_object(negative))
        if latent is not None:
            hash_parts.append(self._hash_object(latent))
        if image is not None:
            hash_parts.append(self._hash_object(image))

        current_hash = out[self.IDX_HASH]

        if hash_parts:
            # There were new objects on the inputs (other than pipe_in):
            # compute a fresh hash from these individual hashes.
            combined_int = self._combine_hashes(hash_parts)
            new_hash = str(combined_int)
        else:
            # No new objects: keep existing hash if any,
            # otherwise generate from node id.
            if current_hash is None:
                new_hash = str(self._initial_hash_from_node())
            else:
                new_hash = current_hash

        out[self.IDX_HASH] = new_hash
        out_tuple = tuple(out)

        return (
            out_tuple,
            out_tuple[self.IDX_MODEL],
            out_tuple[self.IDX_CLIP],
            out_tuple[self.IDX_VAE],
            out_tuple[self.IDX_POS],
            out_tuple[self.IDX_NEG],
            out_tuple[self.IDX_LATENT],
            out_tuple[self.IDX_IMAGE],
        )


NODE_CLASS_MAPPINGS = {
    "AK Pipe": AKPipe,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Pipe": "AK Pipe",
}
