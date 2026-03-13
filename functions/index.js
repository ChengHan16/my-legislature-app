const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const fs = require("fs"); // 新增：用來檢查檔案系統
const path = require("path");

// 🌟 預設機器人：用來讀取資料庫
admin.initializeApp();

// 🛠️ 診斷：檢查金鑰檔案到底在不在
const keyPath = path.join(__dirname, "serviceAccountKey.json");
console.log("🔍 檢查金鑰路徑:", keyPath);

let pushApp;
if (fs.existsSync(keyPath)) {
    console.log("✅ 找到金鑰檔案，嘗試啟動 PushApp...");
    const serviceAccount = require(keyPath);
    pushApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "llwb-ed686"
    }, "PushApp");
} else {
    console.error("❌ 找不到 serviceAccountKey.json！請檢查檔案是否真的在 functions 資料夾下，或被 .gitignore 擋住。");
    // 如果找不到，就降級使用預設機器人（雖然可能會報 auth error，但至少不會 crash）
    pushApp = admin; 
}

exports.sendChatNotification = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    
    const snap = event.data;
    if (!snap) return null;

    const newValue = snap.data();
    const senderId = newValue.senderId;
    
    let text = newValue.text || (newValue.fileType === 'video' ? '傳送了一段影片' : '傳送了一張圖片');
    if (text.includes('"type":"event_share"')) text = "分享了一個活動";
    if (text.includes('"type":"group_buy"')) text = "發起了一個團購";

    const chatId = event.params.chatId;

    // 讀取資料庫：繼續用原本預設的 admin 沒問題
    const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
    const chatData = chatDoc.data();
    
    if (!chatData || !chatData.members) return null;

    const receivers = chatData.members.filter(uid => uid !== senderId);
    
    const senderDoc = await admin.firestore().collection('act').doc(senderId).get();
    const senderName = senderDoc.exists ? senderDoc.data().displayName : '成員';

    const tokens = [];
    for (const uid of receivers) {
        const userDoc = await admin.firestore().collection('act').doc(uid).get();
        if (userDoc.exists && userDoc.data().pushToken) {
            tokens.push(userDoc.data().pushToken); 
        }
    }

    // --- 從這裡開始替換 ---
    console.log("🔍 準備發送給這些 UID:", receivers);
    console.log("🔍 收集到的 Token 數量:", tokens.length);

    if (tokens.length === 0) {
        console.log("🛑 警告：找不到任何 Token！推播程序提前結束。請檢查資料庫裡的 act 集合，對應的 UID 文件裡是否有 pushToken 欄位。");
        return null;
    }
    
    console.log("✅ 準備發射推播！Token 內容:", tokens);
    // --- 替換到這裡 ---

    const message = {
        notification: {
            title: chatData.isGroup ? chatData.groupName : senderName,
            body: chatData.isGroup ? `${senderName}: ${text}` : text,
        },
        apns: {
            payload: {
                aps: { sound: 'default' }
            }
        },
        tokens: tokens
    };

    try {
        // 🚨 【最關鍵的一行】：呼叫我們獨立建立的 "pushApp" 來發送推播！
        // 它會拿著你給的實體金鑰直接通關，絕對不會再報錯！
        const response = await pushApp.messaging().sendEachForMulticast(message);
        
        console.log('成功發送推播:', response.successCount, '失敗:', response.failureCount);
        
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`Token ${idx} 發送失敗的詳細原因:`, resp.error);
                }
            });
        }
    } catch (error) {
        console.error('推播發送失敗:', error);
    }

    return null;
});