// 1. Firebase 配置
const firebaseConfig = { 
    apiKey: "AIzaSyACnoimIASfb1rb59SbgLDkUmyYR6ODbUU",
    authDomain: "llwb-ed686.firebaseapp.com",
    projectId: "llwb-ed686",
    storageBucket: "llwb-ed686.firebasestorage.app", 
    messagingSenderId: "940345852074",
    appId: "1:940345852074:web:7a30cca5a6d997a92350d3",
    measurementId: "G-KWL4ZE3D18"
};

// 2. 初始化 App 並定義「全域變數」 (這解決了 auth is not defined 的問題)
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

// 將變數定義在最外層，確保所有 function 都能讀取
const db = firebase.firestore();

// 3. 統一版面載入器
async function loadLayout(activeNav) {
    try {
        const headerData = await fetch('./components/dashboard.html').then(res => res.text());
        document.getElementById('header-layout').innerHTML = headerData;
        
        const footerData = await fetch('./components/footer.html').then(res => res.text());
        document.getElementById('footer-layout').innerHTML = footerData;

        // 設定導覽列高亮
        const navLink = document.querySelector(`[data-nav="${activeNav}"]`);
        if (navLink) navLink.classList.add('active-dark');
    } catch (error) {
        console.error("無法載入頁面零件:", error);
    }
}

// 4. 同步成員資料邏輯
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
            if (data.imageUrl && document.getElementById('dynamic-avatar')) {
                document.getElementById('dynamic-avatar').src = data.imageUrl;
            }
        }
    } catch (error) {
        console.error("Firebase 錯誤:", error);
    }
}

// 5. 頁面初始化與狀態監聽
document.addEventListener("DOMContentLoaded", async () => {
    // 執行版面載入
    await loadLayout(' '); 

    // 監聽 Firebase 登入狀態 (此時 auth 已在上方定義，不會報錯)
    auth.onAuthStateChanged((user) => {
        if (user) {
            // --- 權限判斷邏輯 ---
            const adminEmails = ["wu@ll.com"];
            const addEventBtn = document.getElementById('admin-add-event');
            
            if (addEventBtn && adminEmails.includes(user.email)) {
                addEventBtn.style.display = "block"; 
            }
            
            // 如果頁面上有 startEventListen 函式（例如在 add-event.html），就啟動它
            if (typeof startEventListen === "function") {
                startEventListen();
            }
        } else {
            // 未登入導回登入頁
            //window.location.href = "login.html";
        }

        if (user) {
            // --- 權限判斷邏輯 ---
            const adminEmails = ["wu@ll.com"]; // 這裡定義了誰是管理員
            
            const addEventBtn = document.getElementById('admin-add-event');
            const addActBtn = document.getElementById('admin-add-act'); // 取得新按鈕的 ID
            const addTermsBtn = document.getElementById('admin-add-terms');
            
            if (adminEmails.includes(user.email)) {
                // 如果是管理員，顯示所有權限按鈕
                if (addEventBtn) addEventBtn.style.display = "block"; 
                if (addActBtn) addActBtn.style.display = "block"; // 顯示新按鈕
                if (addTermsBtn) addTermsBtn.style.display = "block";
            }
        } else {
            // 未登入導回登入頁
            //window.location.href = "login.html";
        }
    });
});