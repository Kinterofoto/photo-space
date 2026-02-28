import type { Object3DNode } from "@react-three/fiber"

declare module "@react-three/fiber" {
  interface ThreeElements {
    sparkRenderer: Object3DNode<any, any>
    splatMesh: Object3DNode<any, any> & { url?: string }
  }
}
