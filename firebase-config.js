import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDC_5PbDkwCdPbZEmOLJ64SLlqV0WlV9ng",
  authDomain: "campuscare-863b0.firebaseapp.com",
  projectId: "campuscare-863b0",
  storageBucket: "campuscare-863b0.appspot.com",
  messagingSenderId: "393465310274",
  appId: "1:393465310274:web:560fb7c86de0bcfcf311db",
  measurementId: "G-9H4490E390"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

console.log('Firebase initialized successfully');

// Export auth and db for use in other files
export { auth, db };