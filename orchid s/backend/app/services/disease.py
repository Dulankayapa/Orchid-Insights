from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Dict, Optional, Union

import torch
from PIL import Image
from torchvision import models, transforms

from app.core.config import BASE_DIR, ROOT_DIR, get_settings


PLANT_VILLAGE_LABELS = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Background_without_leaves",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___healthy",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Raspberry___healthy",
    "Soybean___healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Yellow_Leaf_Curl_Virus",
    "Tomato___mosaic_virus",
    "Tomato___healthy",
]


def _first_existing(paths):
    return next((p for p in paths if p and Path(p).exists()), None)


def _build_model(num_classes: int):
    model = models.mobilenet_v3_large(weights=None)
    in_features = model.classifier[3].in_features
    model.classifier[3] = torch.nn.Linear(in_features, num_classes)
    return model


@lru_cache(maxsize=1)
def get_model():
    settings = get_settings()
    possible_weight_paths = [
        settings.disease_weights_path,
        BASE_DIR / "models" / "plant_village.pth",
        ROOT_DIR / "models" / "disease" / "plant_village.pth",
        ROOT_DIR.parent / "orchid desease copy" / "models" / "plant_village.pth",
        ROOT_DIR / "models" / "plant_village.pth",
    ]
    weight_path = _first_existing(possible_weight_paths)
    if not weight_path:
        raise FileNotFoundError("PlantVillage weights not found. Set DISEASE_WEIGHTS_PATH.")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = _build_model(num_classes=len(PLANT_VILLAGE_LABELS))
    state = torch.load(weight_path, map_location=device)
    state_dict = state.get("model_state_dict", state) if isinstance(state, dict) else state
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    preprocess = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    return model, preprocess, device


def predict(image: Union[str, Path, Image.Image]) -> Dict[str, object]:
    model, preprocess, device = get_model()
    if isinstance(image, (str, Path)):
        pil_image = Image.open(image)
    elif isinstance(image, (bytes, bytearray)):
        pil_image = Image.open(BytesIO(image))
    else:
        pil_image = image
    pil_image = pil_image.convert("RGB")
    tensor = preprocess(pil_image).unsqueeze(0).to(device)
    with torch.no_grad():
        outputs = model(tensor)
        probs = torch.nn.functional.softmax(outputs, dim=1)
        confidence, index = torch.max(probs, dim=1)
    label = PLANT_VILLAGE_LABELS[index.item()]
    health = "Healthy" if ("healthy" in label.lower() or "background" in label.lower()) else "Diseased"
    return {
        "label": label,
        "health": health,
        "confidence": confidence.item(),
        "index": int(index.item()),
    }
