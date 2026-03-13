const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendChatNotification = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    // 取得新增的訊息資料
    const snap = event.data;
    if (!snap) return null;

    const newValue = snap.data();
    const senderId = newValue.senderId;
    
    // 解析訊息內容 (防呆處理圖片與影片)
    let text = newValue.text || (newValue.fileType === 'video' ? '傳送了一段影片' : '傳送了一張圖片');
    if (text.includes('"type":"event_share"')) text = "分享了一個活動";
    if (text.includes('"type":"group_buy"')) text = "發起了一個團購";

    // 從 event.params 取得網址上的 chatId
    const chatId = event.params.chatId;

    // 1. 取得聊天室資訊
    const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
    const chatData = chatDoc.data();
    
    if (!chatData || !chatData.members) return null;

    // 找出需要接收通知的成員（排除發送者本人）
    const receivers = chatData.members.filter(uid => uid !== senderId);
    
    // 2. 取得發送者的名字
    const senderDoc = await admin.firestore().collection('act').doc(senderId).get();
    const senderName = senderDoc.exists ? senderDoc.data().displayName : '成員';

    // 3. 收集所有接收者的 Push Token
    const tokens = [];
    for (const uid of receivers) {
        const userDoc = await admin.firestore().collection('act').doc(uid).get();
        if (userDoc.exists && userDoc.data().pushToken) {
            tokens.push(userDoc.data().pushToken); 
        }
    }

    if (tokens.length === 0) {
        console.log('沒有找到接收者的 Token，停止發送推播');
        return null;
    }

    // 4. 打包推播內容 (使用最新版 Multicast 格式)
    const message = {
        notification: {
            title: chatData.isGroup ? chatData.groupName : senderName,
            body: chatData.isGroup ? `${senderName}: ${text}` : text,
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default' // 讓 iOS 收到時有提示音
                }
            }
        },
        tokens: tokens // 一次發送給所有收集到的裝置
    };

    // 5. 正式發送推播
    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log('成功發送推播:', response.successCount, '失敗:', response.failureCount);
        
        // 🚨 【新增這段】：把失敗的「真正原因」印在日誌裡
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