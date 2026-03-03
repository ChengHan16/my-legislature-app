// 1. 統一版面載入器
async function loadLayout(activeNav) {
    try {
        const headerData = await fetch('./components/dashboard.html').then(res => res.text());
        document.getElementById('header-layout').innerHTML = headerData;
        
        // 如果有 footer 容器才執行
        const footerTarget = document.getElementById('footer-layout');
        if (footerTarget) {
            const footerData = await fetch('./components/footer.html').then(res => res.text());
            footerTarget.innerHTML = footerData;
        }

        const navLink = document.querySelector(`[data-nav="${activeNav}"]`);
        if (navLink) navLink.classList.add('active-dark');
    } catch (error) {
        console.error("無法載入頁面零件:", error);
    }
}

// 2. Firebase 配置 (確保全域唯一)
const firebaseConfig = { 
    apiKey: "AIzaSyACnoimIASfb1rb59SbgLDkUmyYR6ODbUU",
    authDomain: "llwb-ed686.firebaseapp.com",
    projectId: "llwb-ed686",
    storageBucket: "llwb-ed686.firebasestorage.app", 
    messagingSenderId: "940345852074",
    appId: "1:940345852074:web:7a30cca5a6d997a92350d3",
    measurementId: "G-KWL4ZE3D18"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// 3. 核心功能：同步成員列表 (即時監聽)
function startMemberSync() {
    const container = document.getElementById('member-container');
    if (!container) return;

    let hasGuardianDivider = false;

    // 監聽 content 集合
    db.collection("content").orderBy("timestamp", "asc").onSnapshot((snapshot) => {
        container.innerHTML = ""; // 移除「載入中」文字
        hasGuardianDivider = false; 

        snapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            const nickname = data.text || '未命名';
            const imgSrc = data.imageUrl || '預設圖片網址';
            const memberLink = data.link || '#';
            const memberNumber = index + 1;

            const isGuardian = nickname.includes("Shiba") || nickname.includes("柴犬") || nickname.includes("吉祥物");

            if (isGuardian && !hasGuardianDivider) {
                const divider = `
                    <div style="flex-basis: 100%; text-align: center; margin: 40px 0 20px;">
                        <hr style="border: 0; height: 1px; background-image: linear-gradient(to right, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0)); margin-bottom: 20px;">
                        <h2 style="font-size: 1.8em; color: #1a237e; letter-spacing: 5px; font-weight: bold;">守護神</h2>
                    </div>`;
                container.insertAdjacentHTML('beforeend', divider);
                hasGuardianDivider = true;
            }

            const cardHTML = `
                <div class="member-item">
                    <div class="member-name-placeholder">成員 ${memberNumber}</div>
                    <div class="member-image-wrapper">
                        <a href="${memberLink}">
                            <img src="${imgSrc}" alt="${nickname} 頭像">
                        </a>
                    </div>
                    <div class="member-title">${nickname}</div>
                </div>`;
            container.insertAdjacentHTML('beforeend', cardHTML);
        });
    }, (error) => {
        console.error("Firebase 讀取失敗:", error);
    });
}

// 4. 核心功能：同步個人/ Banner 資料
async function syncMemberData(targetName, dept, group) {
    if(document.getElementById('banner-dept')) {
        document.getElementById('banner-dept').innerHTML = dept; 
    }
    if(document.getElementById('banner-group')) {
        document.getElementById('banner-group').innerHTML = group; 
    }

    try {
        const snapshot = await db.collection("content").where("text", "==", targetName).get();
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            const avatarEl = document.getElementById('dynamic-avatar');
            if (data.imageUrl && avatarEl) avatarEl.src = data.imageUrl;
        }
    } catch (error) {
        console.error("Firebase 錯誤:", error);
    }
}

// 5. 頁面啟動點
document.addEventListener("DOMContentLoaded", async () => {
    // 載入版面
    await loadLayout('members'); 
    
    // 載入 Banner 資料
    await syncMemberData("班長", "團隊成員介紹", "人員編制說明");

    // 啟動成員即時同步
    startMemberSync();

    // 監聽登入狀態與個人選單資料 (Dashboard 導覽列需求)
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const doc = await db.collection("act").doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (document.getElementById('displayName')) {
                    document.getElementById('displayName').innerText = data.displayName || "使用者";
                }
                if (data.photoURL && document.getElementById('displayAvatar')) {
                    document.getElementById('displayAvatar').src = data.photoURL;
                }
            }
        } else {
            window.location.href = "login.html";
        }
    });
});

/** 以下為選單功能 **/
window.toggleNav = function() {
    const sidebar = document.getElementById("mySidebar");
    const overlay = document.getElementById("overlay");
    if (!sidebar) return;
    const isOpen = sidebar.style.width === "250px";
    sidebar.style.width = isOpen ? "0" : "250px";
    if (overlay) overlay.style.display = isOpen ? "none" : "block";
};

window.confirmLogout = function() {
    if (confirm("確定登出系統？")) {
        auth.signOut().then(() => window.location.href = "login.html");
    }
};