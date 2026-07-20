// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDkBVnqhY4v3B5i_3vBZNFzF1769eOmbgI",
  authDomain: "parcialsoftware-383c1.firebaseapp.com",
  projectId: "parcialsoftware-383c1",
  storageBucket: "parcialsoftware-383c1.firebasestorage.app",
  messagingSenderId: "443664792242",
  appId: "1:443664792242:web:d3ede4702e181088ab67ab"
};

// Replace this with your actual VAPID KEY from Firebase Console -> Cloud Messaging -> Web Push certificates
export const VAPID_KEY = "BG0Ru03d-HXkeBYn1p3Kqu7fUU7q3XOy0tqLuR1FYOKtwLBfav9BxV1StzvZqkfYvpNEfJbTpaxX4-eLhPFbUsI";
const app = initializeApp(firebaseConfig);