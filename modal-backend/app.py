"""
Modal serverless GPU backend for Apple SHARP (3D Gaussian Splatting).

Model loads ONCE on container start, then each prediction is ~18-20s on T4.

Deploy: modal deploy app.py
"""

import modal

app = modal.App("photo-space-sharp")

volume = modal.Volume.from_name("sharp-data", create_if_missing=True)

CHECKPOINT_URL = "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"
CHECKPOINT_PATH = "/root/.cache/sharp/sharp_2572gikvuh.pt"

gpu_image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install("torch", "torchvision", "fastapi", "requests", "numpy")
    .run_commands("pip install git+https://github.com/apple/ml-sharp.git")
    # Bake checkpoint into image → eliminates download on cold start
    .run_commands(
        f"mkdir -p /root/.cache/sharp && "
        f"python -c \"import torch; torch.hub.load_state_dict_from_url('{CHECKPOINT_URL}', model_dir='/root/.cache/sharp', progress=True)\""
    )
)


@app.cls(
    image=gpu_image,
    gpu="T4",
    timeout=120,
    volumes={"/data": volume},
    scaledown_window=300,
)
class SharpPredictor:
    @modal.enter()
    def load_model(self):
        """Load SHARP model from baked-in checkpoint (~5s)."""
        import logging
        import torch
        from sharp.models import PredictorParams, create_predictor

        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger("sharp-modal")

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.logger.info(f"Using device: {self.device}")

        # Create model on GPU, then load weights directly to GPU
        self.predictor = create_predictor(PredictorParams())
        self.predictor.to(self.device)
        state_dict = torch.load(CHECKPOINT_PATH, map_location=self.device, weights_only=True)
        self.predictor.load_state_dict(state_dict)
        self.predictor.eval()
        self.logger.info("Model loaded and ready.")

    @modal.fastapi_endpoint(method="POST")
    def generate(self, body: dict):
        import os
        import time
        from pathlib import Path
        import requests as http_requests
        from sharp.cli.predict import predict_image, save_ply
        from sharp.utils import io

        image_url = body.get("image_url")
        photo_name = body.get("photo_name")

        if not image_url or not photo_name:
            return {"error": "image_url and photo_name are required", "status": "error"}

        base_name = os.path.splitext(photo_name)[0]
        ply_storage = f"/data/splats/{base_name}.ply"

        if os.path.exists(ply_storage):
            return {"status": "ready"}

        t0 = time.time()

        # Download image
        try:
            resp = http_requests.get(image_url, timeout=30)
            resp.raise_for_status()
        except Exception as e:
            return {"error": f"Failed to download image: {e}", "status": "error"}

        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            f.write(resp.content)
            tmp_path = f.name

        try:
            # Load image using SHARP's io
            image, _, f_px = io.load_rgb(Path(tmp_path))

            # Run prediction (model already loaded!)
            gaussians = predict_image(self.predictor, image, f_px, self.device)

            # Save PLY
            os.makedirs("/data/splats", exist_ok=True)
            h, w = image.shape[:2]
            save_ply(gaussians, f_px, (h, w), Path(ply_storage))
            volume.commit()

            elapsed = time.time() - t0
            self.logger.info(f"Generated {photo_name} in {elapsed:.1f}s")

            return {"status": "ready", "time": round(elapsed, 1)}
        except Exception as e:
            self.logger.error(f"Error generating {photo_name}: {e}")
            return {"error": str(e)[:500], "status": "error"}
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)


@app.function(
    image=modal.Image.debian_slim(python_version="3.13").pip_install("fastapi"),
    volumes={"/data": volume},
    scaledown_window=300,
)
@modal.fastapi_endpoint(method="GET")
def splat(photo_name: str):
    import os
    from fastapi.responses import FileResponse, Response

    base_name = os.path.splitext(photo_name)[0]
    ply_path = f"/data/splats/{base_name}.ply"

    volume.reload()

    if not os.path.exists(ply_path):
        return Response(
            content='{"error":"not found"}',
            status_code=404,
            media_type="application/json",
        )

    return FileResponse(
        path=ply_path,
        media_type="application/octet-stream",
        filename=f"{base_name}.ply",
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
        },
    )
