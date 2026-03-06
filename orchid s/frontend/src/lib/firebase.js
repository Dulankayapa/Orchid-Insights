import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD0lET_4Qpi-W2t0M4OpPGT5NeR2wlyiD0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "orchid-insights-c2456.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DB_URL || "https://orchid-insights-c2456-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "orchid-insights-c2456",
};

if (!firebaseConfig.databaseURL) {
  console.warn("No Firebase databaseURL configured. Set VITE_FIREBASE_DB_URL to point to your RTDB.");
}

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
