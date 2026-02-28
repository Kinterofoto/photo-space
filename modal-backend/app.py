"""
Modal serverless GPU backend for Apple SHARP (3D Gaussian Splatting).

Deploys a FastAPI endpoint that:
1. Receives an image URL + photo name
2. Downloads the image
3. Runs SHARP predict to generate a 3D Gaussian Splat (.ply)
4. Uploads the .ply to Supabase storage
5. Returns the public URL

Deploy: modal deploy app.py
"""

import modal

app = modal.App("photo-space-sharp")

# Persistent volume for caching SHARP model checkpoints
volume = modal.Volume.from_name("sharp-checkpoints", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("git", "wget", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch",
        "torchvision",
        "fastapi",
        "requests",
        "supabase",
    )
    .run_commands("pip install git+https://github.com/apple/ml-sharp.git")
)


@app.function(
    image=image,
    gpu="T4",
    timeout=120,
    volumes={"/checkpoints": volume},
    secrets=[modal.Secret.from_name("photo-space-supabase")],
)
@modal.web_endpoint(method="POST")
def generate(body: dict):
    """
    POST body: { "image_url": "...", "photo_name": "..." }
    Returns: { "ply_url": "...", "status": "ready" } or { "error": "...", "status": "error" }
    """
    import os
    import subprocess
    import tempfile

    import requests

    image_url = body.get("image_url")
    photo_name = body.get("photo_name")

    if not image_url or not photo_name:
        return {"error": "image_url and photo_name are required", "status": "error"}

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

        # Set cache dir so checkpoints persist across cold starts
        env = os.environ.copy()
        env["TORCH_HOME"] = "/checkpoints"

        result = subprocess.run(
            ["sharp", "predict", "-i", img_path, "-o", output_dir],
            capture_output=True,
            text=True,
            timeout=60,
            env=env,
        )

        if result.returncode != 0:
            return {"error": result.stderr[:500], "status": "error"}

        # Find the .ply output file
        ply_files = [f for f in os.listdir(output_dir) if f.endswith(".ply")]
        if not ply_files:
            return {"error": "No .ply file generated", "status": "error"}

        ply_path = os.path.join(output_dir, ply_files[0])

        # Upload to Supabase storage
        try:
            from supabase import create_client

            supabase = create_client(
                os.environ["SUPABASE_URL"],
                os.environ["SUPABASE_SERVICE_KEY"],
            )

            # Strip extension from photo_name for storage path
            base_name = os.path.splitext(photo_name)[0]
            storage_path = f"{base_name}.ply"

            with open(ply_path, "rb") as f:
                supabase.storage.from_("splats").upload(
                    storage_path,
                    f.read(),
                    file_options={"content-type": "application/octet-stream"},
                )

            ply_url = f"{os.environ['SUPABASE_URL']}/storage/v1/object/public/splats/{storage_path}"

            # Commit volume to persist checkpoints
            volume.commit()

            return {"ply_url": ply_url, "status": "ready"}

        except Exception as e:
            return {"error": f"Upload failed: {e}", "status": "error"}
