from __future__ import annotations

import logging
import os
import shutil
import time
from typing import Optional

import joblib
import numpy as np
from flask import Flask, jsonify, render_template, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from PIL import Image, UnidentifiedImageError
from tensorflow.keras import Model
from tensorflow.keras.applications import VGG16
from tensorflow.keras.layers import GlobalAveragePooling2D
from tensorflow.keras.preprocessing.image import img_to_array, load_img
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
MODELS_DIR = os.path.join(BASE_DIR, "Models")

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "solar-clean-ai-secret")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["ALLOWED_EXTENSIONS"] = {"png", "jpg", "jpeg"}
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per day", "10 per minute"],
)

feature_extractor: Optional[Model] = None
svm_classifier = None
scaler = None


def log_and_raise(message: str):
    logging.error(message)
    raise RuntimeError(message)


def load_models() -> None:
    global feature_extractor, svm_classifier, scaler

    try:
        svm_classifier_path = os.path.join(MODELS_DIR, "svm_classifier.pkl")
        scaler_path = os.path.join(MODELS_DIR, "scaler.pkl")

        if not os.path.exists(svm_classifier_path) or not os.path.exists(scaler_path):
            log_and_raise("Model files not found in the Models directory.")

        base_model = VGG16(weights="imagenet", include_top=False, input_shape=(128, 128, 3))
        feature_extractor = Model(
            inputs=base_model.input,
            outputs=GlobalAveragePooling2D()(base_model.output),
        )

        svm_classifier = joblib.load(svm_classifier_path)
        scaler = joblib.load(scaler_path)
        logging.info("ML models loaded successfully.")
    except Exception as exc:
        logging.exception("Failed to load model assets.")
        raise RuntimeError(f"Model startup failed: {exc}") from exc


try:
    load_models()
except Exception as exc:  # pragma: no cover - startup safety
    logging.critical("Application cannot start because model assets failed to load.")
    raise SystemExit(str(exc)) from exc


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in app.config["ALLOWED_EXTENSIONS"]


def verify_image(image_path: str) -> bool:
    try:
        with Image.open(image_path) as img:
            img.verify()
        return True
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logging.error("Invalid image uploaded: %s", exc)
        return False


def predict_dustiness(image_path: str) -> Optional[float]:
    if feature_extractor is None or svm_classifier is None or scaler is None:
        logging.error("Prediction attempted before model initialization.")
        return None

    try:
        image = load_img(image_path, target_size=(128, 128))
        image_array = img_to_array(image) / 255.0
        image_array = np.expand_dims(image_array, axis=0)

        features = feature_extractor.predict(image_array, verbose=0)
        features = scaler.transform(features)
        dust_prob = svm_classifier.predict_proba(features)[:, 1][0]

        dustiness = round(float(dust_prob * 100), 2)
        return max(0.0, min(100.0, dustiness))
    except Exception as exc:
        logging.exception("Prediction error while evaluating the image.")
        return None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "model_loaded": bool(feature_extractor and svm_classifier and scaler),
            "upload_dir": app.config["UPLOAD_FOLDER"],
        }
    )


@app.route("/analyze", methods=["POST"])
@limiter.limit("5 per minute")
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No file selected."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Allowed file types: png, jpg, jpeg"}), 400

    filename = secure_filename(file.filename)
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)

    try:
        start_time = time.time()
        file.save(save_path)

        if not verify_image(save_path):
            return jsonify({"error": "Invalid or corrupted image."}), 400

        dustiness = predict_dustiness(save_path)
        if dustiness is None:
            return jsonify({"error": "Failed to process the uploaded image."}), 500

        elapsed = time.time() - start_time
        logging.info("Processed %s in %.2f seconds.", filename, elapsed)

        return jsonify(
            {
                "success": True,
                "image_path": f"uploads/{filename}",
                "dustiness": dustiness,
                "confidence": round(min(max(dustiness / 100.0, 0.0), 1.0), 2),
            }
        )
    except Exception as exc:
        logging.exception("Error while processing uploaded image.")
        return jsonify({"error": "Server error while processing the image."}), 500
    finally:
        if os.path.exists(save_path):
            os.remove(save_path)


@app.route("/cleanup", methods=["POST"])
def cleanup_uploads():
    try:
        upload_folder = app.config["UPLOAD_FOLDER"]
        if os.path.exists(upload_folder):
            shutil.rmtree(upload_folder)
            os.makedirs(upload_folder, exist_ok=True)
            logging.info("Upload folder cleaned successfully.")
            return jsonify({"success": True, "message": "Upload folder cleaned."}), 200
        return jsonify({"error": "Upload folder does not exist."}), 404
    except Exception as exc:
        logging.exception("Error while cleaning uploads.")
        return jsonify({"error": "Server error while cleaning uploads."}), 500


if __name__ == "__main__":
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
