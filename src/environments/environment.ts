/**
 * Production environment — replace `firebase` with values from the Firebase console.
 *
 * Firebase console: https://console.firebase.google.com
 * 1. Create a project (Spark / free tier is fine).
 * 2. Project settings → Your apps → Web app → copy the `firebaseConfig` object.
 * 3. Enable Authentication → Sign-in method → Email/Password.
 * 4. Create Firestore database in production or test mode, then deploy rules from `firestore.rules`.
 */
export const environment = {
  production: true,
  firebase: {
    apiKey: "AIzaSyCkV2Ynblv4TFVfXooks1tVnCg7_4mpKQ4",
    authDomain: "fitnessapp-46ba0.firebaseapp.com",
    projectId: "fitnessapp-46ba0",
    storageBucket: "fitnessapp-46ba0.firebasestorage.app",
    messagingSenderId: "402450707646",
    appId: "1:402450707646:web:8a73e73f878755f1b99aef"
  },
};
