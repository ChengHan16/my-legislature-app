const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendChatNotification = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    const msgData = event.data.data();
    const chatId = event.params.chatId;
    const senderId = msgData.senderId;

    // 1. 取得聊天室資訊
    const chatDoc = await admin.firestore().collection("chats").doc(chatId).get();
    if (!chatDoc.exists) return null;
    const chatData = chatDoc.data();
    const members = chatData.members || [];

    // 2. 取得發送者名稱
    const senderDoc = await admin.firestore().collection("act").doc(senderId).get();
    const senderName = senderDoc.exists ? senderDoc.data().displayName : "成員";
    const groupName = chatData.isGroup ? chatData.groupName : "";

    // 3. 解析訊息內容
    let bodyText = msgData.text || (msgData.fileType === 'video' ? '[影片]' : '[圖片]');
    if (bodyText.includes('"type":"event_share"')) {
         try {
             const parsed = JSON.parse(bodyText);
             bodyText = `分享了活動：${parsed.title}`;
         } catch(e) { bodyText = "分享了活動"; }
    }

    // 4. 準備推播標題
    let title = chatData.isGroup ? `${groupName} - ${senderName}` : `${senderName} 傳送了新訊息`;

    // 5. 蒐集 Tokens
    const tokens = [];
    const mentionedUids = [];

    for (const uid of members) {
        if (uid === senderId) continue;

        const userDoc = await admin.firestore().collection("act").doc(uid).get();
        if (!userDoc.exists) continue;
        const userData = userDoc.data();

        // 檢查是否被 @ 標記
        let isMentioned = false;
        if (msgData.text && userData.displayName) {
            if (msgData.text.includes(`@${userData.displayName}`) || msgData.text.includes('@All') || msgData.text.includes('@all (全員)')) {
                isMentioned = true;
                mentionedUids.push(uid);
            }
        }

        // 如果在聊天室內且沒被標記，就不發推播
        const isUserInChat = chatData.presence && chatData.presence[uid] === true;
        if (isUserInChat && !isMentioned) continue;

        if (userData.pushToken) {
            tokens.push(userData.pushToken);
        }
    }

    if (tokens.length === 0) return null;

    // 6. 發送推播
    const message = {
        notification: {
            title: mentionedUids.length > 0 ? "🔔 有人在群組提到了你！" : title,
            body: bodyText,
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        },
        tokens: tokens
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`成功發送 ${response.successCount} 則通知`);
    } catch (error) {
        console.error("推播發送出錯:", error);
    }

    return null;
});