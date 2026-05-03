from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import disease, env, growth, health, classifier, devices

settings = get_settings()

app = FastAPI(
    title="Orchid Insights Unified Backend",
    version="0.1.0",
    description="Growth classifier, disease detector, and Firebase bridge in one FastAPI service.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Include routers with the configured API prefix, ensuring it is properly formatted.
api_prefix = settings.api_prefix.rstrip("/")

app.include_router(health.router, prefix=api_prefix)
app.include_router(growth.router, prefix=api_prefix)
app.include_router(disease.router, prefix=api_prefix)
app.include_router(env.router, prefix=api_prefix)
app.include_router(classifier.router, prefix=api_prefix)
app.include_router(devices.router, prefix=api_prefix)


@app.get("/")
def root():
    return {"service": "orchid-insights", "docs": f"{api_prefix}/docs"}
