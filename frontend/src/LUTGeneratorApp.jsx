import React, { useState, useRef } from "react";
import {
  Upload,
  Download,
  Wand2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const LUTGenerator = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const API_URL = "http://localhost:5000";

  const predefinedPrompts = [
    "Adobe5K editor A style: warm natural colors, slight contrast boost",
    "Adobe5K editor B style: cooler tones and higher saturation",
    "Adobe5K editor C style: soft film-like tones, low contrast",
    "Adobe5K editor D style: high contrast cinematic look",
    "Adobe5K editor E style: desaturated vintage look",
  ];

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.match("image/(jpeg|jpg|png)")) {
        setError("Please select a JPG or PNG image");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("Image size should be less than 10MB");
        return;
      }

      setSelectedImage(file);
      setError(null);
      setResult(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage) {
      setError("Please select an image");
      return;
    }

    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("image", selectedImage);
    formData.append("prompt", prompt);

    try {
      const response = await fetch(`${API_URL}/generate-lut`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate LUT");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to generate LUT. Please try again.");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;

    try {
      const response = await fetch(`${API_URL}/download/${result.job_id}`);

      if (!response.ok) {
        throw new Error("Failed to download files");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lut_${result.job_id}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError("Failed to download files. Please try again.");
      console.error("Download error:", err);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setPrompt("");
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center mb-4">
            <Wand2 className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-purple-600 mr-2 sm:mr-3" />
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              LUT Generator
            </h1>
          </div>
          <p className="text-gray-600 text-sm sm:text-base lg:text-lg px-4">
            Transform your images with AI-powered color grading
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4">
                Upload Image
              </h2>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-300 rounded-xl p-6 sm:p-8 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all"
              >
                {imagePreview ? (
                  <div className="space-y-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 sm:max-h-64 mx-auto rounded-lg shadow-lg w-auto"
                    />
                    <p className="text-xs sm:text-sm text-gray-600 break-all px-2">
                      {selectedImage.name}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400" />
                    <p className="text-sm sm:text-base text-gray-600">
                      Click to upload image
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400">
                      JPG or PNG (max 10MB)
                    </p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4">
                Style Prompt
              </h2>

              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Quick Select:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {predefinedPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(p)}
                      className={`text-left px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border-2 transition-all text-sm sm:text-base ${
                        prompt === p
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-gray-200 hover:border-purple-300 text-gray-700"
                      }`}
                    >
                      <span className="font-medium">
                        Style {String.fromCharCode(65 + idx)}:
                      </span>{" "}
                      <span className="text-xs sm:text-sm">
                        {p.split(":")[1]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Or enter custom prompt:
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Warm sunset tones with enhanced contrast"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
                  rows="3"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !selectedImage || !prompt.trim()}
                className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                    <span className="text-sm sm:text-base">
                      Generating LUT...
                    </span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    <span className="text-sm sm:text-base">Generate LUT</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 mr-2 sm:mr-3 flex-shrink-0 mt-0.5 sm:mt-1" />
                  <div>
                    <h3 className="font-semibold text-red-800 mb-1 text-sm sm:text-base">
                      Error
                    </h3>
                    <p className="text-red-600 text-xs sm:text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 mr-2" />
                  <h2 className="text-xl sm:text-2xl font-semibold">
                    LUT Generated!
                  </h2>
                </div>

                {result.preview_before && result.preview_after && (
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-700 mb-3 text-sm sm:text-base">
                      Preview:
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600 mb-2">
                          Before
                        </p>
                        <img
                          src={`${API_URL}${result.preview_before}`}
                          alt="Before"
                          className="w-full rounded-lg shadow-md"
                        />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600 mb-2">
                          After
                        </p>
                        <img
                          src={`${API_URL}${result.preview_after}`}
                          alt="After"
                          className="w-full rounded-lg shadow-md"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4">
                  <h3 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">
                    Generated Files:
                  </h3>
                  <ul className="space-y-1 text-xs sm:text-sm text-gray-600">
                    <li>• {result.lut_name}.cube (Adobe compatible)</li>
                    <li>• {result.lut_name}.xmp (Lightroom preset)</li>
                  </ul>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:shadow-lg transition-all flex items-center justify-center"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Download ZIP
                </button>

                <button
                  onClick={handleReset}
                  className="w-full mt-3 bg-gray-200 text-gray-700 py-2.5 sm:py-3 rounded-lg font-medium text-sm sm:text-base hover:bg-gray-300 transition-all"
                >
                  Start New
                </button>
              </div>
            )}

            {!result && !error && (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold mb-4">
                  How to Use:
                </h3>
                <ol className="space-y-3 text-sm sm:text-base text-gray-600">
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 font-semibold text-xs sm:text-sm mr-3 flex-shrink-0">
                      1
                    </span>
                    <span>Upload a JPG or PNG image</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 font-semibold text-xs sm:text-sm mr-3 flex-shrink-0">
                      2
                    </span>
                    <span>
                      Select a predefined style or enter your own prompt
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 font-semibold text-xs sm:text-sm mr-3 flex-shrink-0">
                      3
                    </span>
                    <span>Click "Generate LUT" and wait for processing</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 font-semibold text-xs sm:text-sm mr-3 flex-shrink-0">
                      4
                    </span>
                    <span>Preview the result and download the LUT files</span>
                  </li>
                </ol>

                <div className="mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">
                    💡 Tips:
                  </h4>
                  <ul className="text-xs sm:text-sm text-blue-800 space-y-1">
                    <li>• Use descriptive prompts for better results</li>
                    <li>
                      • .cube files work in Photoshop, Premiere Pro, DaVinci
                      Resolve
                    </li>
                    <li>• .xmp files can be imported as Lightroom presets</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LUTGenerator;
