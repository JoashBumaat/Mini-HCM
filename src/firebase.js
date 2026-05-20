// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your own Firebase project config
// Go to https://console.firebase.google.com → your project → Project Settings → Your apps
const firebaseConfig = {
  apiKey: "AIzaSyB--b9GemN_jvpc7UEJyxmlpIyCHGchtwg",
  authDomain: "mini-hcm-3d71a.firebaseapp.com",
  projectId: "mini-hcm-3d71a",
  storageBucket: "mini-hcm-3d71a.firebasestorage.app",
  messagingSenderId: "1023581874270",
  appId: "1:1023581874270:web:12a085a7fef94636522ccf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
