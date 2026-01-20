import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuration for 'Cage Service App'
const firebaseConfig = {
  apiKey: "AIzaSyALU1xKWwBZvFqTeWURgUjy1yKRwZN8THQ",
  authDomain: "digital-service-call-sheet.firebaseapp.com",
  projectId: "digital-service-call-sheet",
  storageBucket: "digital-service-call-sheet.firebasestorage.app",
  messagingSenderId: "967660524594",
  appId: "1:967660524594:web:6a3aa296e6df4105b3582b",
  measurementId: "G-W73E25BLZ1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);