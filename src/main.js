import './styles.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

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
const SPREAD = 400

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

// Add a photo into 3D space
function addPhoto(imageUrl) {
  const img = new Image()
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
    photos.push({
      mesh,
      floatSpeed: 0.2 + Math.random() * 0.5,
      floatOffset: Math.random() * Math.PI * 2,
    })

    updateCounter()
  }
  img.src = imageUrl
}

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
    const reader = new FileReader()
    reader.onload = (ev) => addPhoto(ev.target.result)
    reader.readAsDataURL(file)
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
    const reader = new FileReader()
    reader.onload = (ev) => addPhoto(ev.target.result)
    reader.readAsDataURL(file)
  })
})

// Render loop
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const t = clock.getElapsedTime()

  photos.forEach(({ mesh, floatSpeed, floatOffset }) => {
    mesh.position.y += Math.sin(t * floatSpeed + floatOffset) * 0.005
    mesh.rotation.y += 0.0003
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
