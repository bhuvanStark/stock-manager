// firebase-config.js

// Firebase v8 CDN already loaded in index.html

// Prevent duplicate app initialization
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyA-Jc3Lwrvd06aXdzg9xhyp6YMaefaryIs",
    authDomain: "stock-manager-24e42.firebaseapp.com",
    databaseURL: "https://stock-manager-24e42-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "stock-manager-24e42",
    storageBucket: "stock-manager-24e42.appspot.com",
    messagingSenderId: "116764560364",
    appId: "1:116764560364:web:0daab1daf060923626cec9"
  });
} else {
  firebase.app(); // Use the already initialized app
}

// Reference to the Realtime Database
var database = firebase.database();
