# AKPipe.py

class AKPipe:
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
        "PIPE_OUT",
        "MODEL",
        "CLIP",
        "VAE",
        "POSITIVE",
        "NEGATIVE",
        "LATENT",
        "IMAGE",
    )

    FUNCTION = "run"
    CATEGORY = "AK/pipe"

    IDX_MODEL = 0
    IDX_CLIP = 1
    IDX_VAE = 2
    IDX_POS = 3
    IDX_NEG = 4
    IDX_LATENT = 5
    IDX_IMAGE = 6

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
        if pipe_in is None:
            out = (
                model,
                clip,
                vae,
                positive,
                negative,
                latent,
                image,
            )
            return (
                out,
                out[self.IDX_MODEL],
                out[self.IDX_CLIP],
                out[self.IDX_VAE],
                out[self.IDX_POS],
                out[self.IDX_NEG],
                out[self.IDX_LATENT],
                out[self.IDX_IMAGE],
            )

        if isinstance(pipe_in, tuple):
            pipe = pipe_in
        else:
            pipe = tuple(pipe_in)

        if len(pipe) < 7:
            pipe = pipe + (None,) * (7 - len(pipe))

        out = pipe
        changed = False

        def apply(idx, v):
            nonlocal out, changed
            if v is None:
                return
            if not changed:
                if out[idx] is v:
                    return
                tmp = list(out)
                tmp[idx] = v
                out = tuple(tmp)
                changed = True
            else:
                if out[idx] is v:
                    return
                tmp = list(out)
                tmp[idx] = v
                out = tuple(tmp)

        apply(self.IDX_MODEL, model)
        apply(self.IDX_CLIP, clip)
        apply(self.IDX_VAE, vae)
        apply(self.IDX_POS, positive)
        apply(self.IDX_NEG, negative)
        apply(self.IDX_LATENT, latent)
        apply(self.IDX_IMAGE, image)

        return (
            out,
            out[self.IDX_MODEL],
            out[self.IDX_CLIP],
            out[self.IDX_VAE],
            out[self.IDX_POS],
            out[self.IDX_NEG],
            out[self.IDX_LATENT],
            out[self.IDX_IMAGE],
        )


NODE_CLASS_MAPPINGS = {
    "AK Pipe": AKPipe,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Pipe": "AK Pipe",
}
