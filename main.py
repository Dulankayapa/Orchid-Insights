from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Orchid Monitor API")

# VERY IMPORTANT: Allow React to talk to Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/latest")
def get_latest_data():
    return {
        "temperature": 31.3,
        "humidity": 66.5,
        "lux": 77,
        "mq135": 1703
    }
