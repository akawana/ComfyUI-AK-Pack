from comfy_api.latest import ComfyExtension, io


class AKPipe(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="AK Pipe",
            display_name="AK Pipe",
            category="AK/pipe",
            inputs=[
                io.Custom("AK_PIPE").Input("pipe_in", optional=True),
                io.Model.Input("model",    optional=True),
                io.Clip.Input("clip",      optional=True),
                io.Vae.Input("vae",        optional=True),
                io.Conditioning.Input("positive", optional=True),
                io.Conditioning.Input("negative", optional=True),
                io.Latent.Input("latent",  optional=True),
                io.Image.Input("image",    optional=True),
            ],
            outputs=[
                io.Custom("AK_PIPE").Output(display_name="pipe_out"),
                io.Model.Output(display_name="model"),
                io.Clip.Output(display_name="clip"),
                io.Vae.Output(display_name="vae"),
                io.Conditioning.Output(display_name="positive"),
                io.Conditioning.Output(display_name="negative"),
                io.Latent.Output(display_name="latent"),
                io.Image.Output(display_name="image"),
            ],
        )

    @classmethod
    def execute(
        cls,
        pipe_in=None,
        model=None,
        clip=None,
        vae=None,
        positive=None,
        negative=None,
        latent=None,
        image=None,
    ) -> io.NodeOutput:
        if pipe_in is not None:
            p_model, p_clip, p_vae, p_pos, p_neg, p_latent, p_image = pipe_in
        else:
            p_model = p_clip = p_vae = p_pos = p_neg = p_latent = p_image = None

        if model    is not None: p_model  = model
        if clip     is not None: p_clip   = clip
        if vae      is not None: p_vae    = vae
        if positive is not None: p_pos    = positive
        if negative is not None: p_neg    = negative
        if latent   is not None: p_latent = latent
        if image    is not None: p_image  = image

        pipe_out = (p_model, p_clip, p_vae, p_pos, p_neg, p_latent, p_image)

        return io.NodeOutput(pipe_out, p_model, p_clip, p_vae, p_pos, p_neg, p_latent, p_image)


class AKPipeExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [AKPipe]


async def comfy_entrypoint() -> AKPipeExtension:
    return AKPipeExtension()


NODE_CLASS_MAPPINGS = {
    "AK Pipe": AKPipe,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AK Pipe": "AK Pipe",
}
