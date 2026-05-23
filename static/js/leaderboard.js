import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, limit, where }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyAJ-ZjKo1wR_nhxpQdNdx63l_8dwr8TsZ0",
    authDomain: "goosegame-9ae37.firebaseapp.com",
    projectId: "goosegame-9ae37",
    storageBucket: "goosegame-9ae37.firebasestorage.app",
    messagingSenderId: "957784668643",
    appId: "1:957784668643:web:94aadc40dff274672e88d6"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

function sanitizeUsername(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
}

export async function submitScore(rawUsername, score, difficulty) {
    const username = sanitizeUsername(rawUsername);
    if (!username) throw new Error('Invalid username');
    await addDoc(collection(db, 'scores'), {
        username,
        score,
        difficulty,
        createdAt: Date.now()
    });
}

export async function getTopScores(difficulty, n = 10) {
    const q = query(
        collection(db, 'scores'),
        where('difficulty', '==', difficulty),
        orderBy('score', 'desc'),
        limit(n)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteScore(id) {
    await deleteDoc(doc(db, 'scores', id));
}

export async function adminSignIn() {
    const provider = new GoogleAuthProvider();
    const result   = await signInWithPopup(auth, provider);
    return result.user;
}

export async function adminSignOut() {
    await signOut(auth);
}

export function getCurrentUser() {
    return auth.currentUser;
}
