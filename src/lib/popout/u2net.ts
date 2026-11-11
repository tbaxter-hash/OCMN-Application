// Runs U²-Net-p (Qin et al., Apache-2.0) — a small salient-object model that finds the
// main subject of a photo, people and objects alike — on TensorFlow.js.
//
// The model was exported from ONNX to a compact JSON graph plus float32 weights
// (public/popout/u2netp.json + u2netp.bin) and is interpreted op by op here, so it
// needs only WebGL (or the plain-JS CPU fallback): no WebAssembly, no extra scripts.

import type * as TF from "@tensorflow/tfjs-core";

type GraphNode = {
  op: "Conv" | "Relu" | "MaxPool" | "Resize" | "Concat" | "Add" | "Sigmoid";
  in: string[];
  out: string;
  w?: [number, number]; // [offset, length] into the weights, in floats
  wshape?: [number, number, number, number]; // HWIO
  b?: [number, number];
  dil?: number;
  pad?: number;
  size?: [number, number];
};

type Graph = { input: string; output: string; size: number; nodes: GraphNode[]; weights: number };

export type U2Net = {
  size: number;
  /** Subject probability (0..1) for a size×size RGBA image. */
  predict(rgba: Uint8ClampedArray): Promise<Float32Array>;
  /** Raw network output for an already-normalised NHWC input (for testing). */
  forward(x: Float32Array): Promise<Float32Array>;
};

let tfPromise: Promise<typeof TF> | null = null;

async function loadTf(): Promise<typeof TF> {
  if (!tfPromise) {
    tfPromise = (async () => {
      const tf = await import("@tensorflow/tfjs-core");
      await import("@tensorflow/tfjs-backend-cpu");
      try {
        await import("@tensorflow/tfjs-backend-webgl");
        if (await tf.setBackend("webgl")) {
          await tf.ready();
          return tf;
        }
      } catch {
        // no WebGL: fall through to the CPU backend
      }
      await tf.setBackend("cpu");
      await tf.ready();
      return tf;
    })();
    tfPromise.catch(() => (tfPromise = null));
  }
  return tfPromise;
}

export async function loadU2Net(graphUrl: string, weightsUrl: string): Promise<U2Net> {
  const [tf, graph, weights] = await Promise.all([
    loadTf(),
    fetchOk(graphUrl).then((r) => r.json() as Promise<Graph>),
    fetchOk(weightsUrl).then((r) => r.arrayBuffer()),
  ]);
  const all = new Float32Array(weights);
  if (all.length !== graph.weights) throw new Error("The detection model download was incomplete.");
  const slice = (r: [number, number]) => all.subarray(r[0], r[0] + r[1]);

  const params = graph.nodes.map((n) =>
    n.op === "Conv"
      ? {
          w: tf.tensor4d(slice(n.w!), n.wshape!),
          b: tf.tensor1d(slice(n.b!)),
        }
      : null,
  );

  // last use of each intermediate, so it can be freed as soon as possible
  const lastUse = new Map<string, number>();
  const uses = new Map<string, number>();
  graph.nodes.forEach((n, i) =>
    n.in.forEach((name) => {
      lastUse.set(name, i);
      uses.set(name, (uses.get(name) ?? 0) + 1);
    }),
  );
  // a Conv whose only consumer is the very next Relu runs as one fused conv+relu
  const fuseRelu = graph.nodes.map(
    (n, i) =>
      n.op === "Conv" &&
      graph.nodes[i + 1]?.op === "Relu" &&
      graph.nodes[i + 1].in[0] === n.out &&
      uses.get(n.out) === 1,
  );

  const S = graph.size;
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  async function forward(x: Float32Array): Promise<Float32Array> {
    const env = new Map<string, TF.Tensor>();
    env.set(graph.input, tf.tensor4d(x, [1, S, S, 3]));
    graph.nodes.forEach((n, i) => {
      const ins = n.in.map((name) => env.get(name)!);
      let y: TF.Tensor;
      switch (n.op) {
        case "Conv":
          y = tf.fused.conv2d({
            x: ins[0] as TF.Tensor4D,
            filter: params[i]!.w,
            bias: params[i]!.b,
            strides: 1,
            pad: n.pad ?? 0,
            dilations: n.dil ?? 1,
            activation: fuseRelu[i] ? "relu" : "linear",
          });
          break;
        case "Relu":
          // already applied by the fused conv before it
          y = fuseRelu[i - 1] ? ins[0] : tf.relu(ins[0]);
          if (y === ins[0]) {
            env.set(n.out, y);
            env.delete(n.in[0]);
            return;
          }
          break;
        case "MaxPool":
          // ceil_mode 2×2/2 pooling == TF "same" padding
          y = tf.maxPool(ins[0] as TF.Tensor4D, 2, 2, "same");
          break;
        case "Resize":
          y = tf.image.resizeBilinear(ins[0] as TF.Tensor4D, n.size!, false, true);
          break;
        case "Concat":
          y = tf.concat(ins, 3);
          break;
        case "Add":
          y = tf.add(ins[0], ins[1]);
          break;
        case "Sigmoid":
          y = tf.sigmoid(ins[0]);
          break;
      }
      env.set(n.out, y);
      for (const name of n.in) {
        if (lastUse.get(name) === i && name !== graph.output) {
          env.get(name)?.dispose();
          env.delete(name);
        }
      }
    });
    const out = env.get(graph.output)!;
    const data = (await out.data()) as Float32Array;
    env.forEach((t) => t.dispose());
    return data;
  }

  return {
    size: S,
    forward,
    async predict(rgba) {
      // normalise like the reference implementation: x / max(x), then ImageNet mean/std
      let max = 1;
      for (let i = 0; i < rgba.length; i += 4) max = Math.max(max, rgba[i], rgba[i + 1], rgba[i + 2]);
      const x = new Float32Array(S * S * 3);
      for (let p = 0; p < S * S; p++) {
        for (let c = 0; c < 3; c++) x[p * 3 + c] = (rgba[p * 4 + c] / max - mean[c]) / std[c];
      }

      const data = await forward(x);

      // stretch to 0..1 like the reference post-processing
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of data) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const res = new Float32Array(data.length);
      const k = hi - lo > 1e-6 ? 1 / (hi - lo) : 0;
      for (let i = 0; i < data.length; i++) res[i] = (data[i] - lo) * k;
      return res;
    },
  };
}

async function fetchOk(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Couldn't download the detection model (${r.status}).`);
  return r;
}
