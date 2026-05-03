#!/usr/bin/env python3
"""
Generate demo safetensors weight files for AgentForge demo.

Tiny transformer architecture per agent:
  embed_dim=64, ff_dim=128, vocab_size=512, n_layers=2

Each file is deterministically seeded so outputs are reproducible.
Output: demo/weights/genesis-<name>.safetensors
"""

import os
import struct
import json
import numpy as np

# ---------------------------------------------------------------------------
# Minimal safetensors writer (no dependency beyond numpy/struct)
# Spec: https://github.com/huggingface/safetensors#format
# Header: 8-byte little-endian uint64 header_len, then header_len JSON bytes,
# then raw tensor data (F32 little-endian, C-contiguous).
# ---------------------------------------------------------------------------

DTYPE_MAP = {
    "float32": "F32",
}


def _write_safetensors(tensors: dict, path: str) -> None:
    """Write a dict of name -> np.ndarray (float32) to a .safetensors file."""
    metadata: dict = {}
    offset = 0
    for name, arr in tensors.items():
        assert arr.dtype == np.float32, f"Expected float32, got {arr.dtype} for {name}"
        nbytes = arr.nbytes
        metadata[name] = {
            "dtype": "F32",
            "shape": list(arr.shape),
            "data_offsets": [offset, offset + nbytes],
        }
        offset += nbytes

    header_json = json.dumps(metadata, separators=(",", ":"))
    # Pad header to 8-byte alignment
    while len(header_json) % 8 != 0:
        header_json += " "

    header_bytes = header_json.encode("utf-8")
    header_len = len(header_bytes)

    with open(path, "wb") as f:
        f.write(struct.pack("<Q", header_len))
        f.write(header_bytes)
        for arr in tensors.items():
            f.write(arr[1].astype(np.float32).tobytes())


# ---------------------------------------------------------------------------
# Architecture
# ---------------------------------------------------------------------------

EMBED_DIM = 64
FF_DIM = 128
VOCAB_SIZE = 512
N_LAYERS = 2


def build_agent_tensors(seed: int) -> dict:
    rng = np.random.default_rng(seed)

    def r(*shape):
        """Draw from N(0, 0.02) -- standard weight initialisation scale."""
        return rng.standard_normal(shape).astype(np.float32) * 0.02

    tensors = {}

    # Token embedding
    tensors["embed.weight"] = r(VOCAB_SIZE, EMBED_DIM)

    for layer_idx in range(N_LAYERS):
        pfx = f"layers.{layer_idx}"

        # Self-attention projections
        tensors[f"{pfx}.attn.q_proj.weight"] = r(EMBED_DIM, EMBED_DIM)
        tensors[f"{pfx}.attn.q_proj.bias"]   = r(EMBED_DIM)
        tensors[f"{pfx}.attn.k_proj.weight"] = r(EMBED_DIM, EMBED_DIM)
        tensors[f"{pfx}.attn.k_proj.bias"]   = r(EMBED_DIM)
        tensors[f"{pfx}.attn.v_proj.weight"] = r(EMBED_DIM, EMBED_DIM)
        tensors[f"{pfx}.attn.v_proj.bias"]   = r(EMBED_DIM)
        tensors[f"{pfx}.attn.out_proj.weight"] = r(EMBED_DIM, EMBED_DIM)
        tensors[f"{pfx}.attn.out_proj.bias"]   = r(EMBED_DIM)

        # Feed-forward
        tensors[f"{pfx}.mlp.fc1.weight"] = r(FF_DIM, EMBED_DIM)
        tensors[f"{pfx}.mlp.fc1.bias"]   = r(FF_DIM)
        tensors[f"{pfx}.mlp.fc2.weight"] = r(EMBED_DIM, FF_DIM)
        tensors[f"{pfx}.mlp.fc2.bias"]   = r(EMBED_DIM)

        # Layer norms
        tensors[f"{pfx}.ln1.weight"] = np.ones(EMBED_DIM, dtype=np.float32)
        tensors[f"{pfx}.ln1.bias"]   = np.zeros(EMBED_DIM, dtype=np.float32)
        tensors[f"{pfx}.ln2.weight"] = np.ones(EMBED_DIM, dtype=np.float32)
        tensors[f"{pfx}.ln2.bias"]   = np.zeros(EMBED_DIM, dtype=np.float32)

    # Final layer norm + output head
    tensors["ln_f.weight"] = np.ones(EMBED_DIM, dtype=np.float32)
    tensors["ln_f.bias"]   = np.zeros(EMBED_DIM, dtype=np.float32)
    tensors["lm_head.weight"] = r(VOCAB_SIZE, EMBED_DIM)

    return tensors


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------

AGENTS = [
    ("aurelius",  1),
    ("vesper",    2),
    ("borealis",  3),
    ("cassia",    4),
    ("drogon",    5),
]


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "demo", "weights")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Output directory: {out_dir}")
    print(f"Architecture: embed_dim={EMBED_DIM}, ff_dim={FF_DIM}, vocab_size={VOCAB_SIZE}, n_layers={N_LAYERS}\n")

    total_bytes = 0
    for name, seed in AGENTS:
        path = os.path.join(out_dir, f"genesis-{name}.safetensors")
        tensors = build_agent_tensors(seed)
        _write_safetensors(tensors, path)
        size = os.path.getsize(path)
        total_bytes += size
        print(f"  genesis-{name}.safetensors   seed={seed}   size={size / 1024:.1f} KB   tensors={len(tensors)}")

    print(f"\nTotal demo/weights size: {total_bytes / 1024:.1f} KB ({total_bytes / 1024 / 1024:.2f} MB)")
    print("\nDone. Files ready for demo.")


if __name__ == "__main__":
    main()
