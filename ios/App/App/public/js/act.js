async function loadLayout(activeNav) {
    try {
        // 使用相對路徑抓取零件
        const headerData = await fetch('./components/header.html').then(res => res.text());
        // 確保這裡的 ID 與 HTML 中的 <div id="..."> 一致
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

// 2. Firebase 與成員資料抓取 (您的原本邏輯)
const firebaseConfig = { 
    apiKey: "AIzaSyACnoimIASfb1rb59SbgLDkUmyYR6ODbUU",
    authDomain: "llwb-ed686.firebaseapp.com",
    projectId: "llwb-ed686",
    storageBucket: "llwb-ed686.firebasestorage.app", 
    messagingSenderId: "940345852074",
    appId: "1:940345852074:web:7a30cca5a6d997a92350d3",
    measurementId: "G-KWL4ZE3D18"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}