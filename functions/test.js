const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "llwb-ed686" // 👈 加上這行防呆，強迫綁定專案
});

// 👇 【請修改這裡】：把你在資料庫裡的那串超長 pushToken 貼上來替換掉
const targetToken = "eeGiZim570-_uGgVJMn6Zy:APA91bGbVg0W96hcaeHbjUNryYqigPNCbifEaxgHDa1gAkWCNlReBKqAfNNsag7HO-SnJKA8VzlYfr-95gcNZP1gnQogyVUXgfSHKENtZRo9EB64Np0GSG8"; 

const message = {
  notification: {
    title: "🖥️ 本地端直接發送測試",
    body: "如果你看到這個，代表金鑰沒問題，是 Google 雲端主機壞了！"
  },
  token: targetToken
};

async function testPush() {
    console.log("🚀 準備從本地電腦發送推播...");
    try {
        const response = await admin.messaging().send(message);
        console.log("🎉 發送成功！Google 伺服器回應碼:", response);
    } catch (error) {
        console.error("❌ 發送失敗，錯誤詳情:", error);
    }
}

testPush();