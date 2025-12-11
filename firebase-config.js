// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDC_5PbDkwCdPbZEmOLJ64SLlqV0WlV9ng",
  authDomain: "campuscare-863b0.firebaseapp.com",
  projectId: "campuscare-863b0",
  storageBucket: "campuscare-863b0.firebasestorage.app",
  messagingSenderId: "393465310274",
  appId: "1:393465310274:web:560fb7c86de0bcfcf311db",
  measurementId: "G-9H4490E390"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);