import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { readFileSync } from "node:fs";

(async () => {
  const path = process.argv[2] ?? "public/assets/birch_sapling_v1.glb";
  const buf = readFileSync(path);
  const loader = new GLTFLoader();
  const gltf = await new Promise<any>((res, rej) =>
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", res, rej)
  );
  console.log("file:", path);
  gltf.scene.traverse((n: any) => {
    if (n.isMesh) {
      const attrs = Object.keys(n.geometry.attributes);
      const col = n.geometry.attributes.color;
      console.log("  mesh:", n.name, "attrs:", attrs, "mat:", n.material.type, "vertexColors:", n.material.vertexColors);
      if (col) {
        console.log(
          "    color attr count=", col.count,
          "normalized=", col.normalized,
          "itemSize=", col.itemSize,
          "first=", [col.getX(0), col.getY(0), col.getZ(0)].map((v) => +v.toFixed(3))
        );
      }
    }
  });
})();
