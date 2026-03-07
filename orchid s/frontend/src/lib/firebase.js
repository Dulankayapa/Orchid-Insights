import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const DEFAULT_FIREBASE_DB_URL = "https://orchid-86ea4-default-rtdb.asia-southeast1.firebasedatabase.app";
export const resolvedDatabaseURL = import.meta.env.VITE_FIREBASE_DB_URL || DEFAULT_FIREBASE_DB_URL;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDpHxImNTuWqDADdYcXsMA2sPEzC6I_q-k",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "orchid-86ea4.firebaseapp.com",
  databaseURL: resolvedDatabaseURL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "orchid-86ea4",
};

if (!firebaseConfig.databaseURL) {
  console.warn("No Firebase databaseURL configured. Set VITE_FIREBASE_DB_URL to point to your RTDB.");
}

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
