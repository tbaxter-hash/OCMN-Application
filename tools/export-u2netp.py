# Exports U^2-Net-p (ONNX) to the compact JSON graph + float32 weights that
# src/lib/popout/u2net.ts interprets with TensorFlow.js (public/popout/u2netp.*).
#
# Model: U^2-Net-p, Qin et al. 2020, Apache-2.0 (github.com/xuebinqin/U-2-Net).
# ONNX file: https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
# Usage: pip install onnx onnxruntime numpy && python tools/export-u2netp.py
#        (run next to u2netp.onnx; writes u2netp.json and u2netp.bin)
import json, numpy as np, onnx, onnxruntime as ort
from onnx import numpy_helper, helper
m = onnx.load("u2netp.onnx"); g = m.graph
W = {i.name: numpy_helper.to_array(i) for i in g.initializer}
KEEP = {"Conv", "Relu", "MaxPool", "Resize", "Concat", "Add", "Sigmoid"}
real = {"input.1"}
nodes = []
for n in g.node:
    if n.op_type not in KEEP: continue
    if n.op_type == "Concat":
        if helper.get_attribute_value(n.attribute[0]) != 1: continue
        if not all(i in real for i in n.input): continue
    if n.op_type == "Resize" and n.input[0] not in real: continue
    if n.op_type in ("Add",) and not all(i in real for i in n.input): continue
    nodes.append(n); real.add(n.output[0])
# static Resize output sizes: expose them as outputs and run once
resizes = [n.output[0] for n in nodes if n.op_type == "Resize"]
m2 = onnx.load("u2netp.onnx")
for r in resizes: m2.graph.output.append(helper.make_tensor_value_info(r, onnx.TensorProto.FLOAT, None))
sess = ort.InferenceSession(m2.SerializeToString())
x = np.random.RandomState(0).randn(1, 3, 320, 320).astype(np.float32)
res = sess.run(None, {"input.1": x})
names = [o.name for o in sess.get_outputs()]
shape = {n: v.shape for n, v in zip(names, res)}
blobs, off, out = [], 0, []
def add(arr):
    global off
    a = np.ascontiguousarray(arr, dtype=np.float32); blobs.append(a.tobytes())
    r = [off, a.size]; off += a.size; return r
for n in nodes:
    a = {x.name: helper.get_attribute_value(x) for x in n.attribute}
    e = {"op": n.op_type, "in": [i for i in n.input if i in real], "out": n.output[0]}
    if n.op_type == "Conv":
        w = W[n.input[1]]  # OIHW -> HWIO
        e["w"] = add(w.transpose(2, 3, 1, 0)); e["wshape"] = list(w.transpose(2, 3, 1, 0).shape)
        e["b"] = add(W[n.input[2]]); e["dil"] = a["dilations"][0]; e["pad"] = a["pads"][0]
        assert a["strides"] == [1, 1] and a["group"] == 1
    if n.op_type == "Resize":
        e["size"] = list(shape[n.output[0]][2:])
    out.append(e)
graph = {"input": "input.1", "output": g.output[0].name, "size": 320, "nodes": out, "weights": off}
json.dump(graph, open("u2netp.json", "w"), separators=(",", ":"))
open("u2netp.bin", "wb").write(b"".join(blobs))
print(len(out), "nodes,", off * 4, "bytes of weights")
