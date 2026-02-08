import './styles.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const SUPABASE_URL = 'https://hjyvteniydaswgohnasr.supabase.co'
const BUCKET = 'photos'
const MANIFEST_URL = '/manifest.json'

function fullUrl(filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`
}

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)
scene.fog = new THREE.FogExp2(0x000000, 0.003)

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000)
camera.position.set(0, 0, 150)

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

// Controls
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.rotateSpeed = 0.5
controls.zoomSpeed = 1.2
controls.panSpeed = 0.8
controls.minDistance = 5
controls.maxDistance = 2000

// Light
const ambient = new THREE.AmbientLight(0xffffff, 1.5)
scene.add(ambient)

// State
const photos = []
const photoFilenames = new Map()
const SPREAD = 200
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let mouseDownPos = null
let downloading = false

// Particle dust
function createDust() {
  const geo = new THREE.BufferGeometry()
  const count = 2000
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * SPREAD * 3
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.5,
    transparent: true,
    opacity: 0.15,
    sizeAttenuation: true,
  })
  scene.add(new THREE.Points(geo, mat))
}
createDust()

// Add photo from base64 data URL
function addPhoto(dataUrl, filename) {
  const img = new Image()
  img.onload = () => {
    const texture = new THREE.Texture(img)
    texture.needsUpdate = true
    texture.colorSpace = THREE.SRGBColorSpace

    const aspect = img.width / img.height
    // Size photos so the longest side is ~30 units
    const size = 25 + Math.random() * 10
    const width = aspect >= 1 ? size : size * aspect
    const height = aspect >= 1 ? size / aspect : size

    const geo = new THREE.PlaneGeometry(width, height)
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
    })

    const mesh = new THREE.Mesh(geo, mat)

    mesh.position.set(
      (Math.random() - 0.5) * SPREAD,
      (Math.random() - 0.5) * SPREAD,
      (Math.random() - 0.5) * SPREAD
    )

    mesh.rotation.x = (Math.random() - 0.5) * 0.3
    mesh.rotation.y = (Math.random() - 0.5) * 0.3
    mesh.rotation.z = (Math.random() - 0.5) * 0.15

    scene.add(mesh)
    photoFilenames.set(mesh.uuid, filename)
    photos.push({
      mesh,
      floatSpeed: 0.2 + Math.random() * 0.5,
      floatOffset: Math.random() * Math.PI * 2,
      glowIntensity: 0,
    })
  }
  img.src = dataUrl
}

// Load all photos from manifest (single fetch)
async function loadPhotos() {
  try {
    const res = await fetch(MANIFEST_URL)
    const manifest = await res.json()
    document.getElementById('counter').textContent = `${manifest.length} photos`
    manifest.forEach(({ name, thumb }) => addPhoto(thumb, name))
  } catch (err) {
    console.error('Failed to load manifest:', err)
  }
}
loadPhotos()

// Download full quality
function downloadPhoto(photoEntry) {
  if (downloading) return
  downloading = true

  const { mesh } = photoEntry
  const filename = photoFilenames.get(mesh.uuid)
  if (!filename) { downloading = false; return }

  photoEntry.glowIntensity = 1.0

  setTimeout(async () => {
    try {
      const res = await fetch(fullUrl(filename))
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(blobUrl)
      showToast()
    } catch (err) {
      console.error('Download failed:', err)
    }
    downloading = false
  }, 300)
}

// Toast
function showToast() {
  let toast = document.getElementById('toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'toast'
    document.body.appendChild(toast)
  }
  toast.textContent = 'saved'
  toast.className = 'toast-show'
  setTimeout(() => { toast.className = 'toast-hide' }, 1200)
}

// Click detection
renderer.domElement.addEventListener('pointerdown', (e) => {
  mouseDownPos = { x: e.clientX, y: e.clientY }
})

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!mouseDownPos) return
  const dx = e.clientX - mouseDownPos.x
  const dy = e.clientY - mouseDownPos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  mouseDownPos = null

  if (dist > 4) return

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const meshes = photos.map((p) => p.mesh)
  const intersects = raycaster.intersectObjects(meshes)

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object
    const entry = photos.find((p) => p.mesh === hitMesh)
    if (entry) downloadPhoto(entry)
  }
})

// Render loop
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const t = clock.getElapsedTime()

  photos.forEach((entry) => {
    const { mesh, floatSpeed, floatOffset } = entry
    mesh.position.y += Math.sin(t * floatSpeed + floatOffset) * 0.005
    mesh.rotation.y += 0.0003

    if (entry.glowIntensity > 0) {
      entry.glowIntensity = Math.max(0, entry.glowIntensity - 0.018)
      const g = entry.glowIntensity
      const boost = 1 + g * 1.5
      mesh.material.color.setRGB(boost, boost, boost)
      mesh.scale.setScalar(1 + g * 0.06)
    } else if (mesh.material.color.r !== 1) {
      mesh.material.color.setRGB(1, 1, 1)
      mesh.scale.setScalar(1)
    }
  })

  controls.update()
  renderer.render(scene, camera)
}
animate()

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
