"""
Modal serverless GPU backend for Apple SHARP (3D Gaussian Splatting).

Deploys two endpoints:
- POST /generate: Receives image URL + photo name, runs SHARP, stores .ply on Volume
- GET /splat: Serves a stored .ply file by name

Deploy: modal deploy app.py
"""

import modal

app = modal.App("photo-space-sharp")

# Volume for model checkpoints AND generated .ply files
volume = modal.Volume.from_name("sharp-data", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("git", "wget", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch",
        "torchvision",
        "fastapi",
        "requests",
    )
    .run_commands("pip install git+https://github.com/apple/ml-sharp.git")
)


@app.function(
    image=image,
    gpu="T4",
    timeout=120,
    volumes={"/data": volume},
)
@modal.fastapi_endpoint(method="POST")
def generate(body: dict):
    """
    POST body: { "image_url": "...", "photo_name": "..." }
    Returns: { "ply_url": "...", "status": "ready" }
    """
    import os
    import shutil
    import subprocess
    import tempfile

    import requests

    image_url = body.get("image_url")
    photo_name = body.get("photo_name")

    if not image_url or not photo_name:
        return {"error": "image_url and photo_name are required", "status": "error"}

    # Check if already generated
    base_name = os.path.splitext(photo_name)[0]
    ply_storage = f"/data/splats/{base_name}.ply"
    if os.path.exists(ply_storage):
        return {"status": "ready"}

    with tempfile.TemporaryDirectory() as tmpdir:
        # Download input image
        img_path = os.path.join(tmpdir, "input.jpg")
        try:
            resp = requests.get(image_url, timeout=30)
            resp.raise_for_status()
        except Exception as e:
            return {"error": f"Failed to download image: {e}", "status": "error"}

        with open(img_path, "wb") as f:
            f.write(resp.content)

        # Run SHARP predict
        output_dir = os.path.join(tmpdir, "output")
        os.makedirs(output_dir, exist_ok=True)

        env = os.environ.copy()
        env["TORCH_HOME"] = "/data/checkpoints"

        result = subprocess.run(
            ["sharp", "predict", "-i", img_path, "-o", output_dir],
            capture_output=True,
            text=True,
            timeout=90,
            env=env,
        )

        if result.returncode != 0:
            return {"error": result.stderr[:500], "status": "error"}

        # Find the .ply output
        ply_files = [f for f in os.listdir(output_dir) if f.endswith(".ply")]
        if not ply_files:
            return {"error": "No .ply file generated", "status": "error"}

        # Copy to persistent volume
        os.makedirs("/data/splats", exist_ok=True)
        shutil.copy2(os.path.join(output_dir, ply_files[0]), ply_storage)
        volume.commit()

        return {"status": "ready"}


@app.function(
    image=modal.Image.debian_slim(python_version="3.13").pip_install("fastapi"),
    volumes={"/data": volume},
)
@modal.fastapi_endpoint(method="GET")
def splat(photo_name: str):
    """
    GET ?photo_name=IMG_1491.JPG → serves the .ply file
    """
    import os

    from fastapi.responses import Response

    base_name = os.path.splitext(photo_name)[0]
    ply_path = f"/data/splats/{base_name}.ply"

    volume.reload()

    if not os.path.exists(ply_path):
        return Response(content='{"error":"not found"}', status_code=404, media_type="application/json")

    with open(ply_path, "rb") as f:
        data = f.read()

    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{base_name}.ply"',
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
        },
    )
