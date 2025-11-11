// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBOiyc-Lhn4FAiJ7Bv2pJFhiCemUarbqwo",
  authDomain: "trode-game.firebaseapp.com",
  projectId: "trode-game",
  storageBucket: "trode-game.firebasestorage.app",
  messagingSenderId: "471068540842",
  appId: "1:471068540842:web:5564eff69c28013215b5d3"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function saveScore(score, playerName = 'Anonymous') {
  try {
    await addDoc(collection(db, 'highscores'), {
      score,
      playerName,
      timestamp: new Date()
    });
  } catch (e) {
    console.error('Error saving score:', e);
  }
}

export async function getHighScores(topN = 5) {
  const q = query(collection(db, 'highscores'), orderBy('score', 'desc'), limit(topN));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}