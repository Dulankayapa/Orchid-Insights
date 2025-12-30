<!-- # 🌱 Orchid Growth Analyzer — Backend Model Documentation

This document explains how the Orchid Growth Analyzer backend works, including
the machine learning model inputs, outputs, preprocessing steps, endpoints, and
overall architecture.

---

# 📌 Overview

The backend is built using **FastAPI** and serves a trained
**RandomForestClassifier ML model**.  
The purpose of the model is to determine whether an orchid plant is:

- **below expected height**  
- **within expected height**  
- **above expected height**  

based on:

1. Planting date  
2. Current date  
3. Current measured plant height  

It also returns the **expected height range** for that age.

---

# 📦 Files Used

The backend loads the following model files:

| File Name | Purpose |
|----------|----------|
| `orchid_growth_rf_model.joblib` | The trained RandomForest ML model |
| `orchid_growth_metadata.joblib` | Metadata (feature columns) needed for prediction |

---

# 🔍 Model Inputs

The backend receives input through the `/analyze-growth` API in JSON format:

```json
{
  "planting_date": "YYYY-MM-DD",
  "current_height_mm": 7.5,
  "current_date": "YYYY-MM-DD"   <-- optional, defaults to today
} -->
