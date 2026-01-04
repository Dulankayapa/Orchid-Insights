import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Orchid Environmental Monitor — Firebase config
export const firebaseConfig = {
  apiKey: 'AIzaSyD0lET_4Qpi-W2t0M4OpPGT5NeR2wlyiD0',
  authDomain: 'orchid-enviromental-monitor-d.firebaseapp.com',
  databaseURL: 'https://orchid-enviromental-monitor-d-default-rtdb.firebaseio.com',
  projectId: 'orchid-enviromental-monitor-d',
};

// Initialize once per bundle
export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
