import './styles.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createClient } from '@supabase/supabase-js'

// Supabase
const supabase = createClient(
  'https://hjyvteniydaswgohnasr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqeXZ0ZW5peWRhc3dnb2huYXNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NDQ4MDAsImV4cCI6MjA4NjEyMDgwMH0.fXb1rptO2FjapwxU-kHDDsgQr2mlLQKLsbbtc3GZZPw'
)
const BUCKET = 'photos'

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

// Controls - orbit, zoom, pan
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
const photoUrls = new Map() // mesh.uuid -> public download URL
const SPREAD = 400
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let mouseDownPos = null
let downloading = false

// Particle dust for atmosphere
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

// Compress image to a ~100kb JPEG thumbnail
function createThumbnail(file, maxSize = 800) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > height && width > maxSize) {
        height = Math.round(height * (maxSize / width))
        width = maxSize
      } else if (height > maxSize) {
        width = Math.round(width * (maxSize / height))
        height = maxSize
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(resolve, 'image/jpeg', 0.6)
    }
    img.src = URL.createObjectURL(file)
  })
}

// Upload original + thumbnail to Supabase and add to scene
async function uploadAndAddPhoto(file) {
  const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const ext = file.name.split('.').pop()

  // Upload original
  const origPath = `originals/${baseName}.${ext}`
  const { error: origErr } = await supabase.storage.from(BUCKET).upload(origPath, file)
  if (origErr) { console.error('Upload original failed:', origErr.message); return }

  // Create and upload thumbnail
  const thumbBlob = await createThumbnail(file)
  const thumbPath = `thumbs/${baseName}.jpg`
  const { error: thumbErr } = await supabase.storage.from(BUCKET).upload(thumbPath, thumbBlob, {
    contentType: 'image/jpeg',
  })
  if (thumbErr) { console.error('Upload thumb failed:', thumbErr.message); return }

  const { data: thumbUrl } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath)
  const { data: origUrl } = supabase.storage.from(BUCKET).getPublicUrl(origPath)
  addPhoto(thumbUrl.publicUrl, origUrl.publicUrl)
}

// Add a photo into 3D space (thumbUrl for display, originalUrl for download)
function addPhoto(thumbUrl, originalUrl) {
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
    photoUrls.set(mesh.uuid, originalUrl)
    photos.push({
      mesh,
      floatSpeed: 0.2 + Math.random() * 0.5,
      floatOffset: Math.random() * Math.PI * 2,
      glowIntensity: 0,
    })

    updateCounter()
  }
  img.src = thumbUrl
}

// Load existing photos from Supabase on startup
async function loadPhotos() {
  const [thumbsRes, originalsRes] = await Promise.all([
    supabase.storage.from(BUCKET).list('thumbs', { limit: 500 }),
    supabase.storage.from(BUCKET).list('originals', { limit: 500 }),
  ])
  if (thumbsRes.error) { console.error('Failed to list thumbs:', thumbsRes.error.message); return }

  // Map baseName -> original filename
  const origMap = new Map()
  if (originalsRes.data) {
    originalsRes.data.forEach((f) => {
      const base = f.name.replace(/\.[^.]+$/, '')
      origMap.set(base, f.name)
    })
  }

  const thumbFiles = thumbsRes.data.filter((f) => f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i))
  thumbFiles.forEach((file) => {
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const origFilename = origMap.get(baseName)
    const { data: thumbUrl } = supabase.storage.from(BUCKET).getPublicUrl(`thumbs/${file.name}`)
    const origPath = origFilename ? `originals/${origFilename}` : `thumbs/${file.name}`
    const { data: origUrl } = supabase.storage.from(BUCKET).getPublicUrl(origPath)
    addPhoto(thumbUrl.publicUrl, origUrl.publicUrl)
  })
}
loadPhotos()

// Counter display
function updateCounter() {
  const el = document.getElementById('counter')
  el.textContent = photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''
}

// File input
const fileInput = document.getElementById('file-input')
const uploadBtn = document.getElementById('upload-btn')

uploadBtn.addEventListener('click', () => fileInput.click())

fileInput.addEventListener('change', (e) => {
  Array.from(e.target.files).forEach((file) => {
    if (!file.type.startsWith('image/')) return
    uploadAndAddPhoto(file)
  })
  fileInput.value = ''
})

// Drag & drop support
document.addEventListener('dragover', (e) => {
  e.preventDefault()
  uploadBtn.style.background = 'rgba(255,255,255,0.25)'
})
document.addEventListener('dragleave', () => {
  uploadBtn.style.background = ''
})
document.addEventListener('drop', (e) => {
  e.preventDefault()
  uploadBtn.style.background = ''
  Array.from(e.dataTransfer.files).forEach((file) => {
    if (!file.type.startsWith('image/')) return
    uploadAndAddPhoto(file)
  })
})

// Download with glow effect
function downloadPhoto(photoEntry) {
  if (downloading) return
  downloading = true

  const { mesh } = photoEntry
  const url = photoUrls.get(mesh.uuid)
  if (!url) { downloading = false; return }

  // Trigger glow animation
  photoEntry.glowIntensity = 1.0

  // Download after a brief glow moment
  setTimeout(async () => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `photo-${Date.now()}.${blob.type.split('/')[1] || 'png'}`
      a.click()
      URL.revokeObjectURL(blobUrl)
      showToast()
    } catch (err) {
      console.error('Download failed:', err)
    }
    downloading = false
  }, 300)
}

// Minimal toast notification
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

// Click detection — only trigger if mouse didn't drag
renderer.domElement.addEventListener('pointerdown', (e) => {
  mouseDownPos = { x: e.clientX, y: e.clientY }
})

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!mouseDownPos) return
  const dx = e.clientX - mouseDownPos.x
  const dy = e.clientY - mouseDownPos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  mouseDownPos = null

  // Only count as click if mouse barely moved (not a drag/orbit)
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

    // Glow fade animation — pulse scale + white flash via color
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

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
