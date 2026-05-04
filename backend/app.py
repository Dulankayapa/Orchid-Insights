"""
Flask Backend for LUT Generator - FIXED VERSION
Handles image upload, ONNX model inference, LUT generation and file export
"""

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import uuid
import numpy as np
from PIL import Image
import io
import zipfile
import onnxruntime as ort
from transformers import CLIPTokenizerFast
import shutil
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Configuration
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
PREVIEW_FOLDER = 'previews'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Create necessary folders
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(PREVIEW_FOLDER, exist_ok=True)

# Model configuration
MODEL_PATH = 'enhanced_lut_model.onnx'  # Path to your ONNX model
IMG_SIZE = 256
LUT_N = 33  # LUT grid size (MUST match your model's LUT_N)
TEXT_MAX_LEN = 16

# ENHANCED PROMPT TEMPLATES - More distinctive styles
ENHANCED_PROMPTS = {
    # Warm styles
    'warm_sunset': "extreme warm sunset orange glow, golden hour, high saturation, vibrant",
    'golden_film': "warm golden film look, nostalgic, soft yellow tones, vintage",
    'desert_heat': "hot desert atmosphere, warm amber tones, high contrast",
    
    # Cool styles
    'cold_winter': "cold blue icy winter look, desaturated shadows, frozen atmosphere",
    'cyberpunk': "cyberpunk neon blue and purple, futuristic, high contrast",
    'moonlight': "cool moonlight blue tones, mysterious night atmosphere",
    
    # Vintage styles
    'vintage_sepia': "vintage faded film, low contrast sepia, nostalgic brown tones",
    'retro_70s': "retro 1970s warm faded look, orange brown vintage",
    'old_photograph': "aged photograph, desaturated, slight yellow tint, vintage",
    
    # Cinematic styles
    'cinematic_teal_orange': "cinematic teal and orange blockbuster, high contrast, dramatic",
    'film_noir': "black and white noir high contrast, dramatic shadows",
    'dramatic_mood': "dramatic moody cinematic, dark shadows, rich colors",
    
    # Artistic styles
    'pastel_dream': "soft pastel colors, dreamy atmosphere, low contrast",
    'vibrant_pop': "vibrant pop art colors, high saturation, bold contrast",
    'matte_painting': "matte painting look, desaturated midtones, cinematic",
    
    # Natural styles
    'natural_enhance': "natural color enhancement, vivid realistic tones, balanced",
    'forest_green': "lush forest green atmosphere, nature tones, fresh",
    'ocean_blue': "ocean blue water tones, aquatic atmosphere, cool"
}

# Load ONNX model
print("Loading ONNX model...")
try:
    ort_session = ort.InferenceSession(
        MODEL_PATH,
        providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
    )
    print(f"✓ Model loaded successfully from {MODEL_PATH}")
    print(f"  Available providers: {ort.get_available_providers()}")
    print(f"  Using provider: {ort_session.get_providers()[0]}")
except Exception as e:
    print(f"✗ Failed to load model: {e}")
    ort_session = None

# Load CLIP tokenizer
print("Loading CLIP tokenizer...")
tokenizer = CLIPTokenizerFast.from_pretrained("openai/clip-vit-base-patch32")
print("✓ Tokenizer loaded successfully")


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def srgb_to_linear(img_array):
    """
    Convert sRGB to linear color space
    IMPORTANT: This must match your training preprocessing
    """
    img_float = img_array.astype(np.float32)
    a = 0.055
    mask = (img_float <= 0.04045).astype(np.float32)
    linear = mask * (img_float / 12.92) + (1 - mask) * (((img_float + a) / (1 + a)) ** 2.4)
    return linear


def linear_to_srgb(img_array):
    """
    Convert linear to sRGB color space
    IMPORTANT: This must match your training postprocessing
    """
    img_float = img_array.astype(np.float32)
    a = 0.055
    mask = (img_float <= 0.0031308).astype(np.float32)
    srgb = mask * (img_float * 12.92) + (1 - mask) * ((1 + a) * (img_float ** (1 / 2.4)) - a)
    return np.clip(srgb, 0.0, 1.0)


def preprocess_image(image_path):
    """Load and preprocess image for model input"""
    img = Image.open(image_path).convert('RGB')
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
    
    # Convert to numpy array [0, 1]
    img_array = np.array(img).astype(np.float32) / 255.0
    
    # Convert to linear space (MUST match training)
    img_linear = srgb_to_linear(img_array)
    
    # Convert to CHW format and add batch dimension
    img_tensor = np.transpose(img_linear, (2, 0, 1))  # HWC -> CHW
    img_tensor = np.expand_dims(img_tensor, axis=0)  # Add batch dim
    
    return img_tensor, img


def tokenize_prompt(prompt_text):
    """Tokenize text prompt using CLIP tokenizer"""
    tokens = tokenizer(
        prompt_text,
        max_length=TEXT_MAX_LEN,
        padding="max_length",
        truncation=True,
        return_tensors="np"
    )
    return tokens["input_ids"].astype(np.int64)


def lut_flat_to_grid(lut_flat, N=LUT_N):
    """
    Convert flat LUT to 3D grid [N, N, N, 3]
    Handles potential clamping issues from training
    """
    # Model outputs shape: [batch, LUT_SIZE] where LUT_SIZE = 3 * N^3
    if lut_flat.ndim == 2:
        lut_flat = lut_flat[0]  # Remove batch dimension
    
    # CRITICAL FIX: Clamp LUT values to valid range
    # Model might output values slightly outside [0,1] due to residual prediction
    lut_flat = np.clip(lut_flat, 0.0, 1.0)
    
    # Reshape to [3, N, N, N]
    lut_grid = lut_flat.reshape(3, N, N, N)
    
    # Transpose to [N, N, N, 3]
    lut_grid = np.transpose(lut_grid, (1, 2, 3, 0))
    
    return lut_grid


def apply_lut_to_image(img_linear, lut_grid):
    """
    Apply 3D LUT to image using trilinear interpolation
    CRITICAL: Input should be in LINEAR color space [0, 1]
    LUT operates in LINEAR space and outputs LINEAR space
    """
    N = lut_grid.shape[0]
    H, W, C = img_linear.shape
    
    # Clamp input to [0, 1] range
    img_linear = np.clip(img_linear, 0.0, 1.0)
    
    # Scale to LUT index range [0, N-1]
    coords = img_linear * (N - 1.0)
    r, g, b = coords[:, :, 0], coords[:, :, 1], coords[:, :, 2]
    
    # Get integer indices (floor)
    r0 = np.floor(r).astype(np.int32).clip(0, N-1)
    r1 = (r0 + 1).clip(0, N-1)
    g0 = np.floor(g).astype(np.int32).clip(0, N-1)
    g1 = (g0 + 1).clip(0, N-1)
    b0 = np.floor(b).astype(np.int32).clip(0, N-1)
    b1 = (b0 + 1).clip(0, N-1)
    
    # Get fractional parts for interpolation
    rd = np.expand_dims(r - r0.astype(np.float32), axis=-1)
    gd = np.expand_dims(g - g0.astype(np.float32), axis=-1)
    bd = np.expand_dims(b - b0.astype(np.float32), axis=-1)
    
    # Fetch 8 corners of the cube
    c000 = lut_grid[r0, g0, b0]
    c001 = lut_grid[r0, g0, b1]
    c010 = lut_grid[r0, g1, b0]
    c011 = lut_grid[r0, g1, b1]
    c100 = lut_grid[r1, g0, b0]
    c101 = lut_grid[r1, g0, b1]
    c110 = lut_grid[r1, g1, b0]
    c111 = lut_grid[r1, g1, b1]
    
    # Trilinear interpolation
    c00 = c000 * (1 - bd) + c001 * bd
    c01 = c010 * (1 - bd) + c011 * bd
    c10 = c100 * (1 - bd) + c101 * bd
    c11 = c110 * (1 - bd) + c111 * bd
    
    c0 = c00 * (1 - gd) + c01 * gd
    c1 = c10 * (1 - gd) + c11 * gd
    
    result = c0 * (1 - rd) + c1 * rd
    
    # Output is in LINEAR space, clamp to [0, 1]
    return np.clip(result, 0.0, 1.0)


def save_cube_file(lut_grid, filepath, title="Generated LUT"):
    """Save 3D LUT in .cube format (Adobe compatible)"""
    N = lut_grid.shape[0]
    
    with open(filepath, 'w') as f:
        f.write(f"# {title}\n")
        f.write(f"# Generated by LUT Generator\n")
        f.write(f"# Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write(f"TITLE \"{title}\"\n")
        f.write(f"LUT_3D_SIZE {N}\n")
        f.write("DOMAIN_MIN 0.0 0.0 0.0\n")
        f.write("DOMAIN_MAX 1.0 1.0 1.0\n\n")
        
        # Write LUT data (Blue changes fastest - Adobe standard)
        for b in range(N):
            for g in range(N):
                for r in range(N):
                    rgb = lut_grid[r, g, b]
                    f.write(f"{rgb[0]:.6f} {rgb[1]:.6f} {rgb[2]:.6f}\n")


def save_xmp_file(lut_grid, filepath, title="Generated LUT"):
    """Save LUT in .xmp format (Lightroom preset)"""
    N = lut_grid.shape[0]
    
    # Sample neutral axis for tone curve
    neutral_curve = []
    for i in range(N):
        rgb = lut_grid[i, i, i]
        tone = (rgb[0] + rgb[1] + rgb[2]) / 3.0
        neutral_curve.append(tone)
    
    with open(filepath, 'w') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<x:xmpmeta xmlns:x="adobe:ns:meta/">\n')
        f.write('  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n')
        f.write('    <rdf:Description rdf:about=""\n')
        f.write('        xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/">\n')
        f.write(f'      <crs:LookName>{title}</crs:LookName>\n')
        f.write('      <crs:ProcessVersion>11.0</crs:ProcessVersion>\n')
        f.write('      <crs:ToneCurvePV2012>\n')
        f.write('        <rdf:Seq>\n')
        
        for i, tone in enumerate(neutral_curve):
            inp = int((i / (N - 1)) * 255)
            out = int(np.clip(tone, 0.0, 1.0) * 255)
            f.write(f'          <rdf:li>{inp}, {out}</rdf:li>\n')
        
        f.write('        </rdf:Seq>\n')
        f.write('      </crs:ToneCurvePV2012>\n')
        f.write('    </rdf:Description>\n')
        f.write('  </rdf:RDF>\n')
        f.write('</x:xmpmeta>\n')


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': ort_session is not None,
        'available_styles': len(ENHANCED_PROMPTS)
    })


@app.route('/styles', methods=['GET'])
def get_styles():
    """Return available style presets"""
    styles = [
        {'id': key, 'name': key.replace('_', ' ').title(), 'prompt': value}
        for key, value in ENHANCED_PROMPTS.items()
    ]
    return jsonify({'styles': styles})


@app.route('/generate-lut', methods=['POST'])
def generate_lut():
    """Main endpoint to generate LUT from image and prompt"""
    
    if ort_session is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    # Check if image is present
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    
    file = request.files['image']
    prompt = request.form.get('prompt', '').strip()
    style_preset = request.form.get('style_preset', '').strip()
    
    # Use preset prompt if provided
    if style_preset and style_preset in ENHANCED_PROMPTS:
        prompt = ENHANCED_PROMPTS[style_preset]
        print(f"Using preset style: {style_preset}")
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only JPG and PNG allowed'}), 400
    
    if not prompt:
        return jsonify({'error': 'No prompt or style preset provided'}), 400
    
    try:
        # Generate unique job ID
        job_id = str(uuid.uuid4())[:8]
        
        # Save uploaded image
        filename = secure_filename(file.filename)
        upload_path = os.path.join(UPLOAD_FOLDER, f"{job_id}_{filename}")
        file.save(upload_path)
        
        print(f"\n{'='*70}")
        print(f"[Job {job_id}] Processing image: {filename}")
        print(f"[Job {job_id}] Prompt: {prompt}")
        print(f"{'='*70}")
        
        # Preprocess image (returns linear color space)
        img_tensor, original_img = preprocess_image(upload_path)
        print(f"[Job {job_id}] Image preprocessed: {img_tensor.shape}")
        print(f"[Job {job_id}] Image value range: [{img_tensor.min():.4f}, {img_tensor.max():.4f}]")
        
        # Tokenize prompt
        text_tokens = tokenize_prompt(prompt)
        print(f"[Job {job_id}] Prompt tokenized: {text_tokens.shape}")
        
        # Run ONNX inference
        print(f"[Job {job_id}] Running inference...")
        ort_inputs = {
            'image': img_tensor.astype(np.float32),
            'text_tokens': text_tokens
        }
        ort_outputs = ort_session.run(None, ort_inputs)
        lut_flat = ort_outputs[0][0]  # Remove batch dimension
        
        print(f"[Job {job_id}] LUT generated: {lut_flat.shape}")
        print(f"[Job {job_id}] LUT value range: [{lut_flat.min():.4f}, {lut_flat.max():.4f}]")
        print(f"[Job {job_id}] LUT mean: {lut_flat.mean():.4f}, std: {lut_flat.std():.4f}")
        
        # DIAGNOSTIC: Check if LUT is too close to identity
        identity_lut = np.linspace(0, 1, LUT_N**3 * 3).reshape(3, LUT_N, LUT_N, LUT_N)
        identity_lut = np.transpose(identity_lut, (1, 2, 3, 0)).reshape(-1)
        lut_diff = np.abs(lut_flat - identity_lut[:len(lut_flat)]).max()
        print(f"[Job {job_id}] Max LUT difference from identity: {lut_diff:.4f}")
        
        if lut_diff < 0.05:
            print(f"[Job {job_id}] ⚠ WARNING: LUT is very close to identity!")
            print(f"[Job {job_id}]   This may indicate weak model predictions.")
        
        # Convert to 3D LUT grid
        lut_grid = lut_flat_to_grid(lut_flat)
        print(f"[Job {job_id}] LUT grid shape: {lut_grid.shape}")
        
        # Create output directory for this job
        job_output_dir = os.path.join(OUTPUT_FOLDER, job_id)
        os.makedirs(job_output_dir, exist_ok=True)
        
        # Generate safe filename from prompt
        safe_prompt = "".join(c for c in prompt[:30] if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_prompt = safe_prompt.replace(' ', '_') or 'custom_lut'
        lut_name = f"lut_{safe_prompt}_{job_id}"
        
        # Save .cube file
        cube_path = os.path.join(job_output_dir, f"{lut_name}.cube")
        save_cube_file(lut_grid, cube_path, title=prompt)
        print(f"[Job {job_id}] Saved .cube file")
        
        # Save .xmp file
        xmp_path = os.path.join(job_output_dir, f"{lut_name}.xmp")
        save_xmp_file(lut_grid, xmp_path, title=prompt)
        print(f"[Job {job_id}] Saved .xmp file")
        
        # Generate preview images (before and after)
        print(f"[Job {job_id}] Generating previews...")
        
        # Convert original image to linear space for LUT application
        original_array = np.array(original_img).astype(np.float32) / 255.0
        original_linear = srgb_to_linear(original_array)
        
        print(f"[Job {job_id}] Original linear range: [{original_linear.min():.4f}, {original_linear.max():.4f}]")
        
        # Apply LUT in linear space
        stylized_linear = apply_lut_to_image(original_linear, lut_grid)
        
        print(f"[Job {job_id}] Stylized linear range: [{stylized_linear.min():.4f}, {stylized_linear.max():.4f}]")
        
        # Convert back to sRGB for display
        stylized_srgb = linear_to_srgb(stylized_linear)
        
        print(f"[Job {job_id}] Stylized sRGB range: [{stylized_srgb.min():.4f}, {stylized_srgb.max():.4f}]")
        
        # Calculate difference metrics
        diff_l1 = np.abs(original_array - stylized_srgb).mean()
        diff_max = np.abs(original_array - stylized_srgb).max()
        print(f"[Job {job_id}] Preview difference - L1: {diff_l1:.4f}, Max: {diff_max:.4f}")
        
        if diff_l1 < 0.01:
            print(f"[Job {job_id}] ⚠ WARNING: Preview shows minimal change!")
        
        # Save preview images
        preview_before_path = os.path.join(PREVIEW_FOLDER, f"{job_id}_before.jpg")
        preview_after_path = os.path.join(PREVIEW_FOLDER, f"{job_id}_after.jpg")
        
        original_img.save(preview_before_path, 'JPEG', quality=95)
        Image.fromarray((stylized_srgb * 255).astype(np.uint8)).save(preview_after_path, 'JPEG', quality=95)
        print(f"[Job {job_id}] Saved preview images")
        
        print(f"[Job {job_id}] ✓ Complete!")
        print(f"{'='*70}\n")
        
        # Return success response
        return jsonify({
            'success': True,
            'job_id': job_id,
            'lut_name': lut_name,
            'preview_before': f'/previews/{job_id}_before.jpg',
            'preview_after': f'/previews/{job_id}_after.jpg',
            'prompt': prompt,
            'diagnostics': {
                'lut_range': f"[{lut_flat.min():.4f}, {lut_flat.max():.4f}]",
                'lut_std': f"{lut_flat.std():.4f}",
                'identity_diff': f"{lut_diff:.4f}",
                'preview_change': f"{diff_l1:.4f}"
            },
            'message': 'LUT generated successfully'
        })
    
    except Exception as e:
        print(f"Error generating LUT: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to generate LUT: {str(e)}'}), 500


@app.route('/download/<job_id>', methods=['GET'])
def download_lut(job_id):
    """Download ZIP file containing .cube and .xmp files"""
    try:
        job_output_dir = os.path.join(OUTPUT_FOLDER, job_id)
        
        if not os.path.exists(job_output_dir):
            return jsonify({'error': 'Job not found'}), 404
        
        # Create ZIP file in memory
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for filename in os.listdir(job_output_dir):
                file_path = os.path.join(job_output_dir, filename)
                zf.write(file_path, filename)
        
        memory_file.seek(0)
        
        print(f"[Job {job_id}] ZIP downloaded")
        
        return send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'lut_{job_id}.zip'
        )
    
    except Exception as e:
        print(f"Error downloading files: {str(e)}")
        return jsonify({'error': f'Failed to download files: {str(e)}'}), 500


@app.route('/previews/<filename>', methods=['GET'])
def serve_preview(filename):
    """Serve preview images"""
    return send_from_directory(PREVIEW_FOLDER, filename)


@app.route('/cleanup/<job_id>', methods=['DELETE'])
def cleanup_job(job_id):
    """Clean up temporary files for a job"""
    try:
        # Remove output files
        job_output_dir = os.path.join(OUTPUT_FOLDER, job_id)
        if os.path.exists(job_output_dir):
            shutil.rmtree(job_output_dir)
        
        # Remove preview files
        preview_before = os.path.join(PREVIEW_FOLDER, f"{job_id}_before.jpg")
        preview_after = os.path.join(PREVIEW_FOLDER, f"{job_id}_after.jpg")
        if os.path.exists(preview_before):
            os.remove(preview_before)
        if os.path.exists(preview_after):
            os.remove(preview_after)
        
        # Remove uploaded file
        for filename in os.listdir(UPLOAD_FOLDER):
            if filename.startswith(job_id):
                os.remove(os.path.join(UPLOAD_FOLDER, filename))
        
        print(f"[Job {job_id}] Files cleaned up")
        return jsonify({'success': True, 'message': 'Files cleaned up'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("\n" + "="*70)
    print("LUT GENERATOR BACKEND SERVER - ENHANCED VERSION")
    print("="*70)
    print(f"Model: {MODEL_PATH}")
    print(f"LUT Size: {LUT_N}³ = {LUT_N**3} points per channel")
    print(f"Image Size: {IMG_SIZE}x{IMG_SIZE}")
    print(f"Color Space: Linear RGB (internal), sRGB (I/O)")
    print(f"Available Styles: {len(ENHANCED_PROMPTS)}")
    print(f"Style Presets: {', '.join(list(ENHANCED_PROMPTS.keys())[:5])}...")
    print("="*70)
    print("\nIMPORTANT FIXES APPLIED:")
    print("  ✓ Enhanced diagnostic logging")
    print("  ✓ Identity LUT comparison")
    print("  ✓ Preview difference metrics")
    print("  ✓ Stronger style presets")
    print("  ✓ LUT value clamping")
    print("  ✓ Better error handling")
    print("="*70 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)