// 监听安装事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装时的处理
    chrome.storage.local.set({
      'settings': {
        'auto_close': true,
        'save_format': 'markdown'
      }
    });
  }
});

// 添加消息处理器类
class MessageHandler {
  static async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'notionConnected':
          await this.handleNotionConnected(message.data);
          break;
        // 其他消息处理...
      }
      sendResponse({ success: true });
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  static async handleNotionConnected({ token, databaseId }) {
    // 处理 Notion 连接逻辑
  }
}

// 注册消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  MessageHandler.handleMessage(message, sender, sendResponse);
  return true; // 保持消息通道开放
});

// 处理 OAuth 回调
chrome.identity.onSignInChanged.addListener((account, signedIn) => {
  if (signedIn) {
    console.log('User signed in:', account);
  } else {
    console.log('User signed out:', account);
  }
});

async function saveToNotion(token, pageId, content) {
  let blocks = [];
  
  // 创建页面属性
  const properties = {
    'Name': {
      title: [{
        text: {
          content: content.title || ''
        }
      }]
    },
    '作者': {
      rich_text: [{
        text: {
          content: content.author || ''
        }
      }]
    },
    '链接': {
      url: content.url || ''
    },
    // 修改类型选择器格式
    '类型': {
      select: {
        name: content.type // "推文"、"线程" 或 "图片"
      }
    },
    '评论数': {
      number: content.stats.comments || 0
    }
  };

  // 创建页面
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { database_id: pageId },
      properties: properties
    })
  });

  return response.json();
}

function determinePostType(tweetData) {
    // 检查是否有子线程
    if (tweetData.conversation_thread && tweetData.conversation_thread.length > 0) {
        return "线程";
    }
    
    // 检查是否只有图片没有文本
    if (tweetData.mediaItems && tweetData.mediaItems.length > 0 && (!tweetData.full_text || tweetData.full_text.trim() === '')) {
        return "图片";
    }
    
    // 默认为推文
    return "推文";
}

// 更新数据库 schema，添加类型选择器
async function updateDatabaseSchema(token, databaseId) {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          '类型': {
            select: {
              options: [
                { name: '推文', color: 'blue' },
                { name: '线程', color: 'green' },
                { name: '图片', color: 'red' }
              ]
            }
          }
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update database schema');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error updating database schema:', error);
    throw error;
  }
}

// 在首次安装或更新时初始化数据库 schema
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    try {
      // 从存储中获取 token 和 databaseId
      const { token, databaseId } = await chrome.storage.local.get(['token', 'databaseId']);
      
      if (token && databaseId) {
        await updateDatabaseSchema(token, databaseId);
        console.log('Database schema updated successfully');
      }
    } catch (error) {
      console.error('Error initializing database schema:', error);
    }
  }
}); 