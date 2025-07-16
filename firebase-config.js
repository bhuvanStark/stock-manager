// firebase-config.js

// Load Firebase v8 compatible
const firebaseConfig = {
  apiKey: "AIzaSyA-Jc3Lwrvd06aXdzg9xhyp6YMaefaryIs",
  authDomain: "stock-manager-24e42.firebaseapp.com",
  databaseURL: "https://stock-manager-24e42-default-rtdb.firebaseio.com",
  projectId: "stock-manager-24e42",
  storageBucket: "stock-manager-24e42.appspot.com",
  messagingSenderId: "116764560364",
  appId: "1:116764560364:web:0daab1daf060923626cec9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

