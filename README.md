![Photo Space](public/og.png)

<h1 align="center">
  Photo Space
</h1>

<p align="center">
  An immersive 3D photo gallery
  <br />
  <br />
  <a href="https://photo-space.vercel.app">Live Demo</a>
  ·
  <a href="https://github.com/Kinterofoto/photo-space/issues">Issues</a>
</p>

<p align="center">
  <a href="https://nextjs.org">
    <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  </a>
  <a href="https://threejs.org">
    <img src="https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
  </a>
  <a href="https://bun.sh">
    <img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun" />
  </a>
  <a href="https://supabase.com">
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  </a>
  <a href="https://www.typescriptlang.org">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
</p>

## About

Photo Space renders your photos as floating cards in a 3D space. Navigate with orbit controls, click to download, and watch textures upgrade as you get closer. On mobile, a masonry gallery with a fullscreen viewer takes over.

## Get Started

```bash
git clone https://github.com/Kinterofoto/photo-space.git
cd photo-space
bun install
bun run dev
```

## Project Structure

```
src/
├── app/                  # Next.js app router
├── components/
│   ├── scene/            # 3D scene (R3F canvas, photo cards, particles, controls)
│   ├── mobile/           # Mobile gallery + photo viewer
│   └── ui/               # shadcn components
├── hooks/                # useManifest
├── lib/                  # Constants, utils
└── types/                # TypeScript definitions
```

## Scripts

```bash
bun run dev                # Dev server (Turbopack)
bun run build              # Production build
bun run generate-manifest  # Regenerate photo manifest from Supabase
```

## License

MIT
