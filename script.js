// --- 1. FIREBASE & AI CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyA6lc5xN08hZwVtXk11SgKFp-jPo7BlXb4",
    authDomain: "afiasec-portal.firebaseapp.com",
    projectId: "afiasec-portal",
    storageBucket: "afiasec-portal.firebasestorage.app",
    messagingSenderId: "602679244218",
    appId: "1:602679244218:web:d6cec9cb7cbef1634d1983",
    measurementId: "G-XFNEDSQJF8"
};

let db;
let activeUser = null;
let currentRole = null; 
let messageUnsubscribe = null;

if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("✅ AFIASEC System: Firebase Linked.");
} else {
    console.error("❌ AFIASEC Error: Firebase SDK not detected.");
    alert("CRITICAL ERROR: Database connection failed.");
}

const GEMINI_API_KEY = "AIzaSyAcR6--ejLxfp1B2_WqcH0k1Ammndm4KPs";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- 2. BACKGROUND SLIDESHOW ---
let currentImgIndex = 1;
function startSlideshow() {
    const bg = document.getElementById('bg-slideshow');
    if (!bg) return;
    
    // Set initial image
    bg.style.backgroundImage = `url('images/bhim1.jpg')`;
    
    setInterval(() => {
        currentImgIndex = currentImgIndex >= 10 ? 1 : currentImgIndex + 1;
        bg.style.backgroundImage = `url('images/bhim${currentImgIndex}.jpg')`;
    }, 5000); 
}

// --- 3. UI & CLOCK ---
function startClock() {
    setInterval(() => {
        const clockElement = document.getElementById('portal-clock');
        if(clockElement) {
            const now = new Date();
            clockElement.innerText = now.toLocaleTimeString([], { hour12: false });
        }
    }, 1000);
}

function showScreen(id) {
    document.querySelectorAll('.glass-panel').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    if(id === 'teacher-dashboard') renderTeacherList();
    if(id === 'student-dashboard') listenForMessages(); 
}

// --- 4. TEACHER LOGIC ---
async function loginTeacher() {
    const passInput = document.getElementById('t-pass-only');
    const pass = passInput.value;
    try {
        const adminRef = db.collection('settings').doc('admin_key');
        const doc = await adminRef.get();
        const masterKey = doc.exists ? doc.data().key : "Admin@12345";

        if(pass === masterKey) {
            currentRole = 'teacher';
            showScreen('teacher-dashboard');
            passInput.value = "";
        } else {
            alert("🛑 ACCESS DENIED");
        }
    } catch (err) { alert("Connection Error."); }
}

async function sendBroadcast() {
    const target = document.getElementById('msg-target').value;
    const message = document.getElementById('broadcast-msg').value;
    if(!message) return alert("Type a message.");

    await db.collection('broadcasts').add({
        target: target,
        message: message,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("📢 DISPATCHED TO: " + target);
    document.getElementById('broadcast-msg').value = "";
}

async function renderTeacherList() {
    const container = document.getElementById('student-grid');
    if(!container) return;
    container.innerHTML = "<p>Accessing Cloud...</p>";
    
    const snapshot = await db.collection('students').get();
    const students = snapshot.docs.map(doc => doc.data());
    container.innerHTML = "";
    
    document.getElementById('stat-total').innerText = students.length;
    document.getElementById('stat-active').innerText = students.filter(s => s.status === 'ACTIVE').length;

    students.forEach(s => {
        const card = document.createElement('div');
        card.style.cssText = "display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.05); padding:10px; border-radius:10px; margin:5px; cursor:pointer; border:1px solid rgba(255,255,255,0.1)";
        card.onclick = () => manageStudent(s.id); 
        card.innerHTML = `
            <img src="${s.photo || ''}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid var(--glow);">
            <div>
                <div style="font-size:0.8rem; font-weight:bold;">${s.name}</div>
                <div style="font-size:0.6rem; color:var(--glow);">${s.id}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

async function manageStudent(id) {
    const studentRef = db.collection('students').doc(id);
    const doc = await studentRef.get();
    const s = doc.data();
    const action = prompt(`MANAGE ${s.name}\n1: ACTIVE\n2: EXEAT\n3: SUSPEND\n4: VIEW ID`);
    
    if(action === '1') await studentRef.update({ status: "ACTIVE", statusReason: "ON CAMPUS" });
    if(action === '2') {
        const reason = prompt("Reason:");
        await studentRef.update({ status: "EXEAT", statusReason: reason });
    }
    if(action === '3') await studentRef.update({ status: "SUSPENDED", statusReason: "DISCIPLINARY" });
    if(action === '4') renderIDCard(s);
    renderTeacherList();
}
// --- MASTER RESET: WIPE ALL STUDENT DATA ---
async function wipeAllStudentData() {
    const confirmation = prompt("⚠️ CRITICAL WARNING: Type 'ERASE' to delete all student records. This cannot be undone.");
    
    if (confirmation === 'ERASE') {
        try {
            const snapshot = await db.collection('students').get();
            const batch = db.batch();

            if (snapshot.empty) {
                alert("Database is already empty.");
                return;
            }

            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            alert("✅ DATABASE PURGED: All student records have been deleted.");
            renderTeacherList(); // Refresh the grid
        } catch (error) {
            console.error("Error wiping data:", error);
            alert("Failed to wipe data. Check permissions.");
        }
    } else {
        alert("Wipe cancelled.");
    }
}

// --- 5. STUDENT LOGIC ---
async function loginStudent() {
    const id = document.getElementById('s-id').value.toUpperCase();
    const pass = document.getElementById('s-pass').value;
    const doc = await db.collection('students').doc(id).get();
    if(doc.exists && doc.data().pass === pass) {
        activeUser = doc.data();
        document.getElementById('greet-user').innerText = `WELCOME, ${activeUser.name.split(' ')[0]}`;
        showScreen('student-dashboard');
    } else { alert("Invalid Credentials."); }
}

async function handleRegister() {
    const btn = event.target;
    const name = document.getElementById('reg-name').value.trim().toUpperCase();
    const pass = document.getElementById('reg-pass').value;
    const photoInput = document.getElementById('reg-photo').files[0];

    if(!name || !photoInput || pass.length < 10) return alert("Check all fields (Pass 10+ chars)");

    btn.disabled = true;
    btn.innerText = "UPLOADING...";

    const reader = new FileReader();
    reader.onload = async function(e) {
        const studentId = "AA-" + Math.floor(100000 + Math.random() * 900000);
        const studentData = {
            id: studentId, name: name, pass: pass,
            year: document.getElementById('reg-year').value,
            home: document.getElementById('reg-home').value,
            parent: document.getElementById('reg-parent').value,
            group: document.getElementById('reg-group').value,
            photo: e.target.result, status: "ACTIVE", statusReason: "NEWLY REGISTERED"
        };
        await db.collection('students').doc(studentId).set(studentData);
        activeUser = studentData;
        alert("ID ASSIGNED: " + studentId);
        showScreen('student-dashboard');
    };
    reader.readAsDataURL(photoInput);
}

function listenForMessages() {
    if(!activeUser || messageUnsubscribe) return;
    messageUnsubscribe = db.collection('broadcasts').orderBy('timestamp', 'desc').limit(1)
      .onSnapshot(snap => {
          snap.docChanges().forEach(change => {
              if (change.type === "added") {
                  const msg = change.doc.data();
                  const isTarget = msg.target === "ALL" || msg.target.includes(activeUser.year) || msg.target === activeUser.group;
                  if(isTarget && msg.timestamp) alert(`📢 MESSAGE:\n"${msg.message}"`);
              }
          });
      });
}

// --- 6. AI & UTILS ---
async function askPortalAI() {
    const input = document.getElementById('ai-input');
    const resp = document.getElementById('ai-response');
    if (!input.value) return;
    resp.innerText = "Analyzing...";
    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            body: JSON.stringify({ contents: [{ parts: [{ text: `Professional AI for AFIASEC. User is ${activeUser?.name}. Query: ${input.value}` }] }] })
        });
        const data = await response.json();
        resp.innerText = data.candidates[0].content.parts[0].text;
        input.value = "";
    } catch (e) { resp.innerText = "AI Offline."; }
}

function logout() { location.reload(); }
function closeIDView() { showScreen(activeUser ? 'student-dashboard' : 'teacher-dashboard'); }

// --- 7. RE-ENGINEERED ID RENDERER ---
function renderIDCard(user) {
    const target = user || activeUser;
    if(!target) return;

    // Fill Text
    document.getElementById('id-img').src = target.photo;
    document.getElementById('id-name-display').innerText = target.name;
    document.getElementById('id-num-display').innerText = target.id;
    document.getElementById('id-home').innerText = target.home;
    document.getElementById('id-parent').innerText = target.parent;
    document.getElementById('id-group').innerText = target.group;
    document.getElementById('id-status').innerText = target.status;
    document.getElementById('id-exeat-reason').innerText = target.statusReason;

    // Generate Larger QR Code (Matches the new 70px CSS)
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = ""; 
    new QRCode(qrContainer, {
        text: `https://afiasec.edu/verify/${target.id}`,
        width: 70,   // Increased Size
        height: 70,  // Increased Size
        colorDark : "#000000",
        colorLight : "#ffffff", // White background for scanning reliability
        correctLevel : QRCode.CorrectLevel.H
    });

    showScreen('id-view');
}

// Global Init
startClock();
startSlideshow();