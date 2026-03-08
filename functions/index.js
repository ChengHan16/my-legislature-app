const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendChatNotification = functions.firestore
    .document("chats/{chatId}/messages/{messageId}")
    .onCreate(async (snap, context) => {
        const msgData = snap.data();
        const chatId = context.params.chatId;
        const senderId = msgData.senderId;

        // 1. 取得聊天室資訊 (為了知道群組名稱跟有哪些成員)
        const chatDoc = await admin.firestore().collection("chats").doc(chatId).get();
        if (!chatDoc.exists) return null;
        const chatData = chatDoc.data();
        const members = chatData.members || [];

        // 2. 取得發送者名稱
        const senderDoc = await admin.firestore().collection("act").doc(senderId).get();
        const senderName = senderDoc.exists ? senderDoc.data().displayName : "成員";
        const groupName = chatData.isGroup ? chatData.groupName : "";

        // 3. 解析訊息內容 (過濾活動卡片或媒體)
        let bodyText = msgData.text || (msgData.fileType === 'video' ? '[影片]' : '[圖片]');
        if (bodyText.includes('"type":"event_share"')) {
             try {
                 const parsed = JSON.parse(bodyText);
                 bodyText = `分享了活動：${parsed.title}`;
             } catch(e) { bodyText = "分享了活動"; }
        }

        // 4. 準備推播標題
        let title = chatData.isGroup ? `${groupName} - ${senderName}` : `${senderName} 傳送了新訊息`;

        // 5. 蒐集需要接收推播的 Token 與判斷 @標記
        const tokens = [];
        const mentions = []; 

        for (const uid of members) {
            if (uid === senderId) continue; // 不發通知給發訊息的人自己

            const userDoc = await admin.firestore().collection("act").doc(uid).get();
            if (!userDoc.exists) continue;
            const userData = userDoc.data();

            // 檢查是否被 @標記
            if (msgData.text && userData.displayName) {
                if (msgData.text.includes(`@${userData.displayName}`) || msgData.text.includes('@All') || msgData.text.includes('@all (全員)')) {
                    mentions.push(uid);
                }
            }

            // 【防干擾機制】：如果對方正在看著這個聊天室，且沒有被 @標記，就不發推播吵他
            const isUserInChat = chatData.presence && chatData.presence[uid] === true;
            if (isUserInChat && !mentions.includes(uid)) continue; 

            // 如果該成員有推播 Token，加入發送名單
            if (userData.pushToken) {
                tokens.push(userData.pushToken);
            }
        }

        if (tokens.length === 0) return null; // 沒人需要通知就結束

        // 6. 設定推播內容並發送
        const payload = {
            notification: {
                title: mentions.length > 0 ? "🔔 有人在群組提到了你！" : title,
                body: bodyText,
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default', // 開啟系統預設通知音效
                        badge: 1          // 應用程式右上角的紅色數字徽章
                    }
                }
            }
        };

        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens: tokens,
                ...payload
            });
            console.log(`推播發送成功！成功: ${response.successCount}, 失敗: ${response.failureCount}`);
        } catch (error) {
            console.error("推播發送失敗:", error);
        }

        return null;
    });