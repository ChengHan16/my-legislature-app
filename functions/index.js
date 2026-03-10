const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

// 監聽 chats/{chatId}/messages/ 集合中是否有新增訊息
exports.sendChatNotification = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    // V2 語法：資料放在 event.data，網址參數放在 event.params
    const snap = event.data;
    if (!snap) return null;

    const messageData = snap.data();
    const chatId = event.params.chatId;
    const senderId = messageData.senderId;

    try {
        // 1. 取得聊天室資訊，找出所有成員
        const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
        if (!chatDoc.exists) return null;
        const chatData = chatDoc.data();
        const members = chatData.members || [];
        
        // 取得發送者的名稱
        const senderDoc = await admin.firestore().collection('act').doc(senderId).get();
        const senderName = senderDoc.exists ? senderDoc.data().displayName : "有新訊息";

        // 準備推播內容 (判斷是文字、圖片還是活動卡片)
        let textContent = "傳送了新訊息";
        if (messageData.text) {
            try {
                const parsed = JSON.parse(messageData.text);
                if (parsed.type === 'event_share') {
                    textContent = `分享了活動：${parsed.title}`;
                } else {
                    textContent = messageData.text;
                }
            } catch (e) {
                textContent = messageData.text;
            }
        } else if (messageData.fileUrl) {
            textContent = messageData.fileType === 'video' ? '[傳送了影片]' : '[傳送了圖片]';
        }

        const groupName = chatData.isGroup ? `[${chatData.groupName}] ` : "";

        // 2. 找出除了發送者以外，所有成員的 Push Token
        const tokens = [];
        for (const uid of members) {
            if (uid !== senderId) {
                const userDoc = await admin.firestore().collection('act').doc(uid).get();
                if (userDoc.exists && userDoc.data().pushToken) {
                    tokens.push(userDoc.data().pushToken);
                }
            }
        }

        // 3. 如果有找到 Token，正式發送推播給 Apple
        if (tokens.length > 0) {
            const message = {
                tokens: tokens,
                notification: {
                    title: `${groupName}${senderName}`,
                    body: textContent,
                },
                data: {
                    chatId: chatId
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1 // 讓 App 圖示右上角出現紅點數字
                        }
                    }
                }
            };

            // 呼叫 Firebase Admin SDK 發送多點推播
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log('成功發送推播，成功數量:', response.successCount);
        } else {
            console.log('沒有找到其他成員的推播 Token');
        }
        return null;

    } catch (error) {
        console.error('發送推播發生錯誤:', error);
        return null;
    }
});