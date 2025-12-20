## Other My Nodes

Utilities for working with Lists, Regions, Toggling groups, Caching conditions: [ComfyUI AK Pack](https://github.com/akawana/ComfyUI-AK-Pack)

Folding of promts in to tree with extra features. Extra shortcuts for editing prompts. Reginal prompting text separation: [ComfyUI Folded Prompts](https://github.com/akawana/ComfyUI-Folded-Prompts)

RGBYP 5-color mask editor: [ComfyUI RGBYP Mask Editor](https://github.com/akawana/ComfyUI-RGBYP-Mask-Editor)

AK XZ Axis so called XY testing for any type of KSampler: [ComfyUI AK XZ Axis](https://github.com/akawana/ComfyUI-AK-XZ-Axis)

---

## Version changes

**V 3.01**

**AK Pipe** Max speed pipe node. Read the description below. 

**V 3.00**

**CLIP Text Encode Cached** node. I highly recommend using it together with **FPFoldedPrompts** and **FPTextAreaPlus** from [ComfyUI Folded Prompts](https://github.com/akawana/ComfyUI-Folded-Prompts) pack!

---

> [!IMPORTANT]
> Guys, the nodes in this pack are the ones I use in my own workflows. I work with them every day. And yes, I change them often — especially if the nodes are in the _testing_ folder. Quite often, after updates, your connections may break. Please keep this in mind. The main purpose of these nodes is performance optimization. Yes, all of them can be found in other packs, but I make them faster.

# ComfyUI-Utils-extra
A compact collection of utility nodes for **ComfyUI** that I could not find in other node packs, but which I need in my production workflow.  
They help automate repetitive tasks, relay group states, manage sampler parameters, and simplify work with lists.

This repository will be gradually expanded with new practical utilities.

---

# Nodes Overview

---
## AK Pipe

AK Pipe is a zero-copy pipeline node that passes a structured pipe object through the graph and updates only explicitly connected inputs. It avoids unnecessary allocations by reusing the original pipe when no values change and creates a new container only on real object replacement.

This design minimizes memory churn and Python overhead, making it significantly faster than traditional pipe merge nodes.

## Index Multiple
**Category:** `utils/list`  

Extracts a specific range from any **List** or **Batch** (images, masks, latents, text � any type) and creates individual outputs for that range.  
Optionally replaces missing values with a fallback (`if_none`).

<details>
<summary><b>Show detailed explanation & examples</b></summary>

<img src="preview_index_multiple.jpg" width="100%"/>

### How it works
1. Connect any List/Batch to `input_any`.
2. Set:
   - `starting_index` � the first index to output  
   - `length` � how many elements to output
3. Outputs are generated as `item_0 � item_49`.  
   Only the first `length` outputs are meaningful.

### Example 1 � simple extraction
Input:  
`[mask_0, mask_1, mask_2, mask_3, mask_4]`

Settings:
- `starting_index = 3`
- `length = 2`

Result:
- `item_0 = mask_3`
- `item_1 = mask_4`

### Example 2 � unknown list length + fallback
If you ask for 5 outputs but receive only 2 items, the rest become `None`, or `if_none` if connected.

</details>

---
## CLIP Encode Multiple
**Category:** `conditioning`  

Extracts a specific range from any **List** or **Batch** of STINGs and CLIP encodes individual outputs for that range.  

Same as Index Multiple but for CLIP encoding. Works faster than regular CLIP Encoders because does only one encoding for all NONE input strings.

Starting from v3+ caches the stings and does not encode them if no changes.

---
## CLIP Text Encode Cached
**Category:** `conditioning`  

This node can cache the previous CONDITIONING and avoids re-encoding. Unfortunately, ComfyUI is designed in such a way that if you change anything in **FPFoldedPrompts** or **FPTextAreaPlus** of [ComfyUI Folded Prompts](https://github.com/akawana/ComfyUI-Folded-Prompts) pack, the encode step will always be triggered. However, you often change text inside the `<ARn>` tags, and this should not cause a re-encode of the main text.

---
## AKSampler Settings
**Category:** `utils/settings`  

A minimalistic node that stores three key sampler parameters:

- `Seed`
- `Denoise`
- `Cfg`

It outputs them as a **LIST**, suitable for passing into:

- **AKSettings Out**
- any **SetNode**
- custom controller graphs

<img src="preview_sampler_settings.jpg" width="100%"/>

---

## AKSettings Out
**Category:** `utils/settings`  

Expands the LIST received from **AKSampler Settings** into three independent outputs:

- `Seed`
- `Denoise`
- `Cfg`

Useful for distributing sampler parameters across multiple samplers or exposing them deeper into the graph.

---

## IsOneOfGroupsActive
**Category:** `utils/logic`  

Checks the state of all groups whose names **contain a specified substring**.  
If **at least one** matching group is Active -> output is `true`.  
If **all** matching groups are Muted/Bypassed -> output is `false`.

<details>
<summary><b>More details</b></summary>

<img src="preview_is_group_active.jpg" width="100%"/>

- Matching is substring-based.  
  Example: `"Face"` matches `FaceFix`, `FaceDetail`, `Faces`, etc.
- If no matching groups are found -> output = `false`.

</details>

---

## RepeatGroupState
**Category:** `utils/logic`  

A connection-free interactive node that synchronizes the state of its own group with the state of other groups matching a given substring.

Logic:

1. Finds groups with names containing the target substring.
2. Checks whether any of them are Active.
3. If **all** matching groups are disabled -> it disables **its own group**.
4. If **any** matching group is active -> it enables **its own group**.

This allows groups to depend on other groups without wires, similar to rgthree repeaters.

<details>

<img src="preview_repeater.jpg" width="100%"/>

<summary><b>Usage examples</b></summary>

### Example 1 � enable your group if �MainFix� is active
Filter: `MainFix`  
If any "MainFix*" group is Active -> enable the current group.

</details>

---

## PreviewRawText
**Category:** `utils`  

Just a text preview bridge node because comfyui ruined the original Preview Any.

---

# Installation

From your ComfyUI root directory:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/akawana/ComfyUI-Utils-extra.git
