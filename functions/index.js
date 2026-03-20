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

    // 【修復 1：過濾發送者，並利用 Set 強制移除陣列中重複的 UID】
    const uniqueReceivers = [...new Set(chatData.members.filter(uid => uid !== senderId))];
    
    const senderDoc = await admin.firestore().collection('act').doc(senderId).get();
    const senderName = senderDoc.exists ? senderDoc.data().displayName : '成員';

    const tokens = [];
    for (const uid of uniqueReceivers) {
        const userDoc = await admin.firestore().collection('act').doc(uid).get();
        if (userDoc.exists && userDoc.data().pushToken) {
            tokens.push(userDoc.data().pushToken); 
        }
    }

    // 【修復 2：將 Token 也強制去重複，確保絕對不會對同一個手機發射兩次推播！】
    const uniqueTokens = [...new Set(tokens)];

    console.log("🔍 準備發送給這些 UID:", uniqueReceivers);
    console.log("🔍 收集到的 Token 數量:", uniqueTokens.length);

    if (uniqueTokens.length === 0) {
        console.log("🛑 警告：找不到任何 Token！推播程序提前結束。");
        return null;
    }
    
    console.log("✅ 準備發射推播！Token 內容:", uniqueTokens);

    // 準備推播包裹
    const message = {
        notification: {
            title: chatData.isGroup ? chatData.groupName : senderName,
            body: chatData.isGroup ? `${senderName}: ${text}` : text,
        },
        data: {
            chatId: String(chatId) 
        },
        apns: {
            payload: {
                aps: { sound: 'default' }
            }
        },
        tokens: uniqueTokens // 【關鍵】：使用過濾後乾淨的 Token 陣列
    };

    try {
        // 使用 sendEachForMulticast 發送給多人
        const response = await pushApp.messaging().sendEachForMulticast(message);
        
        console.log('推播發送結束，成功數量:', response.successCount);
        
        // 如果有失敗，我們過濾出失敗原因但不中斷執行
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.warn(`Token ${idx} 發送失敗:`, resp.error.message);
                    // 這裡可以收集失效的 Token，以後從資料庫刪除
                }
            });
        }
        
    } catch (error) {
        // 這裡攔截的是「嚴重的系統錯誤」（例如金鑰完全失效）
        console.error('推播發送過程發生嚴重錯誤:', error);
    }

    return null;
});