# ComfyUI-Utils-extra
ComfyUI-Utils-extra

A small collection of utility nodes for ComfyUI that I could not find in other custom node packs, but which I need in my own work to simplify and speed up complex workflows.

This repository will be gradually expanded with new practical utilities.

---

## Nodes

### Index Multiple

**Category:** `utils/list`  
**Class name:** `IndexMultiple`

`Index Multiple` takes any **List** or **Batch** as input and creates separate outputs for a selected range inside that list.

The range is defined by two parameters:

- `starting_index` – index of the first item to output (0-based)
- `length` – how many items to output starting from `starting_index`

In addition, the node has an optional input **`if_none`**.  
If provided, any missing values (that would normally be `None`) will be replaced with the value from this input.

---

### How it works

1. You connect a List or Batch (images, masks, latents, text, any type) to `input_any`.
2. You set:
   - `starting_index` — where to start (e.g. `3`)
   - `length` — how many elements you want (e.g. `2`)
3. The node creates outputs:
   - `item_0`, `item_1`, `item_2`, …  
   Internally it will only use the first `length` outputs; the rest will be `None` (or replaced by `if_none`).

---

### Example 1: Simple range extraction

Input List (e.g. masks):  
`[mask_0, mask_1, mask_2, mask_3, mask_4]`  (length = 5)

Node settings:

- `starting_index = 3`
- `length = 2`

Result:

- `item_0 = mask_3`
- `item_1 = mask_4`
- `item_2` … `item_49` = `None` (or `if_none` if provided)

---

### Example 2: Unknown list length + fallback value

Sometimes you know how many items you want, but you do not know how long the input list will be.

For example:

- You want exactly **5 outputs**.
- The incoming List has only **2** elements: `[A, B]`.

Node settings:

- `starting_index = 0`
- `length = 5`
- `if_none` is **not** connected

Result:

- `item_0 = A`
- `item_1 = B`
- `item_2 = None`
- `item_3 = None`
- `item_4 = None`

If you connect something to `if_none` (for example a default mask, image, or any object), all missing values will be replaced with that object:

- `item_2 = if_none`
- `item_3 = if_none`
- `item_4 = if_none`

This lets you avoid extra `Switch` / `If` nodes for handling `None` and keeps graphs cleaner.

---

### About the large number of outputs

Do not be scared by the preview of this node and the fact that it shows so many outputs.

Internally, the node exposes up to **50** outputs (`item_0` … `item_49`), but it will only actively use the first `length` items you configured. The rest will be `None` (or `if_none` if provided) and you can simply ignore them.

---

<img src="preview1.jpg" width="100%"/>

---

## Installation

From your ComfyUI root directory:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/akawana/ComfyUI-Utils-extra.git
