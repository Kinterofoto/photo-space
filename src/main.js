import './styles.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createClient } from '@supabase/supabase-js'

// Supabase
const SUPABASE_URL = 'https://hjyvteniydaswgohnasr.supabase.co'
const supabase = createClient(
  SUPABASE_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqeXZ0ZW5peWRhc3dnb2huYXNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NDQ4MDAsImV4cCI6MjA4NjEyMDgwMH0.fXb1rptO2FjapwxU-kHDDsgQr2mlLQKLsbbtc3GZZPw'
)
const BUCKET = 'photos'

// Thumbnail URL via Supabase image transform
function thumbUrl(filename) {
  return `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/${filename}?width=400&quality=40`
}

// Full quality public URL
function fullUrl(filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`
}

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)
scene.fog = new THREE.FogExp2(0x000000, 0.0015)

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000)
camera.position.set(0, 0, 100)

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
const photoFilenames = new Map() // mesh.uuid -> original filename
const SPREAD = 400
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

// Add a photo into 3D space
function addPhoto(displayUrl, filename) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const texture = new THREE.Texture(img)
    texture.needsUpdate = true
    texture.colorSpace = THREE.SRGBColorSpace

    const aspect = img.width / img.height
    const height = 15 + Math.random() * 10
    const width = height * aspect

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

    updateCounter()
  }
  img.src = displayUrl
}

// Load all photos from Supabase bucket root
async function loadPhotos() {
  // Supabase list returns max 1000 per call, paginate if needed
  let allFiles = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list('', {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) { console.error('Failed to list photos:', error.message); break }
    if (!data || data.length === 0) break
    allFiles = allFiles.concat(data)
    if (data.length < PAGE) break
    offset += PAGE
  }

  const imageFiles = allFiles.filter((f) =>
    f.name.match(/\.(jpg|jpeg|png|webp|gif|heic)$/i)
  )

  updateCounter(imageFiles.length)

  // Load in batches to avoid overwhelming the browser
  const BATCH = 10
  for (let i = 0; i < imageFiles.length; i += BATCH) {
    const batch = imageFiles.slice(i, i + BATCH)
    batch.forEach((file) => {
      addPhoto(thumbUrl(file.name), file.name)
    })
    // Small pause between batches so the scene renders progressively
    if (i + BATCH < imageFiles.length) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}
loadPhotos()

// Counter display
function updateCounter(total) {
  const el = document.getElementById('counter')
  if (total !== undefined) {
    el.textContent = total > 0 ? `${total} photos` : ''
    return
  }
  el.textContent = photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''
}

// Download full quality with glow effect
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
