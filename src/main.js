import './styles.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const SUPABASE_URL = 'https://hjyvteniydaswgohnasr.supabase.co'
const BUCKET = 'photos'
const MANIFEST_URL = '/manifest.json'

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
const MAX_MOBILE_TEXTURES = 30
const MOBILE_LOAD_DIST = 120

function fullUrl(filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`
}

function hiResUrl(filename) {
  const size = isMobile ? 600 : 1200
  return `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/${filename}?width=${size}&height=${size}&resize=contain&quality=75`
}

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)
scene.fog = new THREE.FogExp2(0x000000, 0.003)

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000)
camera.position.set(0, 0, 150)

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'default' })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

// Handle WebGL context loss
let contextLost = false
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault()
  contextLost = true
})
renderer.domElement.addEventListener('webglcontextrestored', () => {
  contextLost = false
  renderer.setSize(window.innerWidth, window.innerHeight)
})

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
let loadedTextureCount = 0

// Placeholder material for mobile (dark gray rectangle)
const placeholderMat = new THREE.MeshBasicMaterial({
  color: 0x1a1a1a,
  side: THREE.DoubleSide,
})

// Particle dust
function createDust() {
  const geo = new THREE.BufferGeometry()
  const count = isMobile ? 500 : 2000
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

// Create texture from base64 (with optional downscale for mobile)
function createTexture(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let source = img
      if (isMobile) {
        const canvas = document.createElement('canvas')
        const aspect = img.width / img.height
        const maxSize = 128
        if (aspect >= 1) {
          canvas.width = maxSize
          canvas.height = Math.round(maxSize / aspect)
        } else {
          canvas.height = maxSize
          canvas.width = Math.round(maxSize * aspect)
        }
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        source = canvas
      }
      const texture = new THREE.Texture(source)
      texture.needsUpdate = true
      texture.colorSpace = THREE.SRGBColorSpace
      resolve({ texture, aspect: img.width / img.height })
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

// Add photo — on desktop: load texture immediately; on mobile: placeholder
function addPhotoDesktop(dataUrl, filename) {
  const img = new Image()
  img.onload = () => {
    const texture = new THREE.Texture(img)
    texture.needsUpdate = true
    texture.colorSpace = THREE.SRGBColorSpace

    const aspect = img.width / img.height
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
      hiRes: false,
      loadingHiRes: false,
      thumbLoaded: true,
      thumbDataUrl: null,
    })
  }
  img.src = dataUrl
}

function addPhotoMobile(dataUrl, filename, aspect) {
  // Parse aspect from the base64 image header or use default
  const size = 25 + Math.random() * 10
  const w = aspect >= 1 ? size : size * aspect
  const h = aspect >= 1 ? size / aspect : size

  const geo = new THREE.PlaneGeometry(w, h)
  const mesh = new THREE.Mesh(geo, placeholderMat)

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
    hiRes: false,
    loadingHiRes: false,
    thumbLoaded: false,
    thumbDataUrl: dataUrl,
    loadingThumb: false,
  })
}

// Mobile: load thumb texture for a nearby photo
function loadThumbForEntry(entry) {
  if (entry.thumbLoaded || entry.loadingThumb || !entry.thumbDataUrl) return
  if (loadedTextureCount >= MAX_MOBILE_TEXTURES) return
  entry.loadingThumb = true

  const img = new Image()
  img.onload = () => {
    if (contextLost) { entry.loadingThumb = false; return }
    const canvas = document.createElement('canvas')
    const aspect = img.width / img.height
    const maxSize = 128
    if (aspect >= 1) {
      canvas.width = maxSize
      canvas.height = Math.round(maxSize / aspect)
    } else {
      canvas.height = maxSize
      canvas.width = Math.round(maxSize * aspect)
    }
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

    const texture = new THREE.Texture(canvas)
    texture.needsUpdate = true
    texture.colorSpace = THREE.SRGBColorSpace

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
    })
    entry.mesh.material = mat
    entry.thumbLoaded = true
    entry.loadingThumb = false
    entry.thumbDataUrl = null // free the base64 string
    loadedTextureCount++
  }
  img.onerror = () => { entry.loadingThumb = false }
  img.src = entry.thumbDataUrl
}

// Mobile: unload texture for a far photo to free GPU memory
function unloadThumb(entry) {
  if (!entry.thumbLoaded || entry.mesh.material === placeholderMat) return
  entry.mesh.material.map.dispose()
  entry.mesh.material.dispose()
  entry.mesh.material = placeholderMat
  entry.thumbLoaded = false
  entry.hiRes = false
  entry.loadingHiRes = false
  loadedTextureCount--
}

// Precompute aspects from base64 for mobile placeholders
function getAspectFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.width / img.height)
    img.onerror = () => resolve(1)
    img.src = dataUrl
  })
}

// Load all photos from manifest
async function loadPhotos() {
  try {
    const res = await fetch(MANIFEST_URL)
    const manifest = await res.json()

    if (!isMobile) {
      manifest.forEach(({ name, thumb }) => addPhotoDesktop(thumb, name))
    } else {
      // On mobile: get aspects first, then create placeholders
      const BATCH = 20
      for (let i = 0; i < manifest.length; i += BATCH) {
        const batch = manifest.slice(i, i + BATCH)
        const aspects = await Promise.all(batch.map(({ thumb }) => getAspectFromDataUrl(thumb)))
        batch.forEach(({ name, thumb }, j) => addPhotoMobile(thumb, name, aspects[j]))
      }
    }
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

// LOD: upgrade texture when camera is close (desktop only)
const LOD_DISTANCE = 60
function upgradeToHiRes(entry) {
  if (entry.hiRes || entry.loadingHiRes) return
  if (isMobile) return // skip hi-res on mobile
  entry.loadingHiRes = true
  const filename = photoFilenames.get(entry.mesh.uuid)
  if (!filename) return

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const texture = new THREE.Texture(img)
    texture.needsUpdate = true
    texture.colorSpace = THREE.SRGBColorSpace
    entry.mesh.material.map.dispose()
    entry.mesh.material.map = texture
    entry.mesh.material.needsUpdate = true
    entry.hiRes = true
  }
  img.onerror = () => { entry.loadingHiRes = false }
  img.src = hiResUrl(filename)
}

// Render loop
const clock = new THREE.Clock()
let mobileTexFrame = 0

function animate() {
  requestAnimationFrame(animate)
  if (contextLost) return

  const t = clock.getElapsedTime()

  // Mobile texture management: every 30 frames, sort by distance and load/unload
  if (isMobile) {
    mobileTexFrame++
    if (mobileTexFrame >= 30) {
      mobileTexFrame = 0
      const sorted = photos.map((entry) => ({
        entry,
        dist: camera.position.distanceTo(entry.mesh.position),
      })).sort((a, b) => a.dist - b.dist)

      // Load closest, unload farthest
      for (let i = 0; i < sorted.length; i++) {
        const { entry, dist } = sorted[i]
        if (i < MAX_MOBILE_TEXTURES && dist < MOBILE_LOAD_DIST) {
          loadThumbForEntry(entry)
        } else if (entry.thumbLoaded && entry.mesh.material !== placeholderMat) {
          unloadThumb(entry)
        }
      }
    }
  }

  photos.forEach((entry) => {
    const { mesh, floatSpeed, floatOffset } = entry
    mesh.position.y += Math.sin(t * floatSpeed + floatOffset) * 0.005
    mesh.rotation.y += 0.0003

    // LOD check (desktop)
    if (!isMobile) {
      const dist = camera.position.distanceTo(mesh.position)
      if (dist < LOD_DISTANCE) upgradeToHiRes(entry)
    }

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
