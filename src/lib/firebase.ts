import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyD3W-r59S3r-bTYm3-xcQCvDe6e2TbWjwM',
  authDomain: 'food-calc-e98ad.firebaseapp.com',
  projectId: 'food-calc-e98ad',
  storageBucket: 'food-calc-e98ad.firebasestorage.app',
  messagingSenderId: '708401840244',
  appId: '1:708401840244:web:42ef573f1a90c27573d121',
}

const firebaseApp = initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

void setPersistence(auth, browserLocalPersistence).catch(() => undefined)
