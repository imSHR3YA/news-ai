// src/firebase.js
// ─────────────────────────────────────────────────────────
//  HOW TO SET UP FIREBASE (free):
//  1. Go to https://console.firebase.google.com
//  2. Click "Add Project" → name it "NewsAI" → Create
//  3. Click the Web icon </>  → Register app as "newsai"
//  4. Copy firebaseConfig values below
//  5. Authentication → Get Started:
//       → Enable "Google" provider
//       → Enable "Email/Password" provider
//  6. Firestore Database → Create Database
//       → Start in Test Mode → Choose region → Enable
// ─────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const isFirebaseEnabled =
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID";

const app = isFirebaseEnabled ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;
export const db = app ? getFirestore(app) : null;
