// 添加 API 版本常量
const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE_URL = 'https://api.notion.com/v1';

// 创建统一的 API 请求工具
class NotionAPI {
  constructor(token) {
    this.token = token;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json'
    };
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${NOTION_BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...this.headers, ...options.headers }
    });
    
    if (!response.ok) {
      const error = await response.json();
      this.handleError(error);
    }
    
    return response.json();
  }

  handleError(error) {
    switch(error.code) {
      case 'unauthorized':
        throw new Error('Token 无效或已过期，请重新输入');
      case 'restricted_resource':
        throw new Error('无访问权限，请确保已将集成添加到数据库');
      case 'rate_limited':
        throw new Error('请求过于频繁，请稍后再试');
      default:
        throw new Error(`请求失败：${error.message || '未知错误'}`);
    }
  }
}

class NotionAuth {
  constructor() {
    this.connectButton = document.getElementById('connectNotion');
    this.saveButton = document.getElementById('saveToNotion');
    this.statusDiv = document.getElementById('status');
    this.pageSelector = document.getElementById('page-selector');
    this.pageSelect = document.getElementById('pageSelect');
    
    if (!this.statusDiv) {
      console.error('Status div not found');
      return;
    }

    this.bindEventListeners();
    
    this.init();
    
    // 加载上次选择的数据库 ID
    this.loadLastSelectedDatabase();

    // 添加请求限制处理工具
    this.rateLimiter = new RateLimiter();
  }

  bindEventListeners() {
    if (this.connectButton) {
      this.connectButton.addEventListener('click', () => {
        console.log('Connect button clicked');
        this.showTokenInput();
      });
    }

    if (this.saveButton) {
      this.saveButton.addEventListener('click', () => {
        console.log('Save button clicked');
        this.saveCurrentPage();
      });
    }
  }

  async init() {
    console.log('Initializing NotionAuth');
    const token = await this.getStoredToken();
    if (token) {
      console.log('Token found, showing save interface');
      this.showSaveInterface();
      this.loadWorkspaces();
    } else {
      console.log('No token found, showing connect interface');
      this.showConnectInterface();
    }
  }

  showConnectInterface() {
    console.log('Showing connect interface');
    if (this.connectButton) {
      this.connectButton.style.display = 'block';
    }
    if (this.saveButton) {
      this.saveButton.style.display = 'none';
    }
    if (this.pageSelector) {
      this.pageSelector.style.display = 'none';
    }
    this.showTokenInput();
  }

  showSaveInterface() {
    console.log('Showing save interface');
    if (this.connectButton) {
      this.connectButton.style.display = 'none';
    }
    if (this.saveButton) {
      this.saveButton.style.display = 'block';
    }
    if (this.pageSelector) {
      this.pageSelector.style.display = 'block';
    }
  }

  showTokenInput() {
    console.log('Showing token input');
    if (!this.statusDiv) return;
    
    this.statusDiv.innerHTML = `
      <p>请按以下步骤操作：</p>
      <ol>
        <li>前往 Notion 开发者页面：<button id="openNotion">打开</button></li>
        <li>创建一个新的集成（New integration）：
          <ul>
            <li>Name: NotionX</li>
            <li>Type: Internal integration</li>
            <li>Logo: 可选</li>
          </ul>
        </li>
        <li>在 Capabilities 
          <ul>
            <li>Read content</li>
            <li>Update content</li>
            <li>Insert content</li>
          </ul>
        </li>
        <li>复制 Internal Integration Token</li>
        <li>在 Notion 中设置权限：
          <ul>
            <li>打开您想要保存内容的 Notion 页面</li>
            <li>点击右上的 ••• 更多选项</li>
            <li>点击 "Connections"</li>
            <li>点击 "Add connections"</li>
            <li>找到并选择刚才创建的集成（NotionX）</li>
          </ul>
        </li>
        <li>粘贴到下方输入框：</li>
      </ol>
      <div class="token-input-wrapper">
        <input type="text" id="tokenInput" class="token-input" placeholder="粘贴完整的 Integration Token">
      </div>
      <div class="token-hint">Token 格式：ntn_xxxxxxxxxxxxxxxx</div>
      <button id="submitToken">确认</button>
    `;

    const openNotionButton = document.getElementById('openNotion');
    const submitTokenButton = document.getElementById('submitToken');
    const tokenInput = document.getElementById('tokenInput');

    if (openNotionButton) {
      openNotionButton.addEventListener('click', () => {
        console.log('Opening Notion integrations page');
        chrome.tabs.create({ url: 'https://www.notion.so/my-integrations' });
      });
    }

    if (submitTokenButton) {
      submitTokenButton.addEventListener('click', () => {
        console.log('Submit token button clicked');
        this.submitToken();
      });
    }

    if (tokenInput) {
      tokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          console.log('Enter pressed in token input');
          this.submitToken();
        }
      });
      setTimeout(() => tokenInput.focus(), 100);
    }
  }

  async loadWorkspaces() {
    try {
      // 检查当前标签页是否是支持的网站
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      
      // 支持的域名列表
      const supportedDomains = [
        'twitter.com',
        'x.com',
        'weixin.qq.com'
      ];
      
      // 检查是否是支持的域名
      const isSupported = supportedDomains.some(domain => 
        url.hostname.includes(domain)
      );
      
      if (!isSupported) {
        throw new Error('当前页面暂不支持提取内容');
      }
      
      const token = await this.getStoredToken();
      console.log('Retrieved token:', token);
      if (!token) {
        this.showError('Token 不能为空');
        return;
      }

      try {
        console.log('Fetching workspaces...');
        // 使用 NotionAPI 类来处理请求
        const notionApi = new NotionAPI(token);

        try {
          const response = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              filter: {
                property: 'object',
                value: 'database'
              },
              page_size: 100
            })
          });

          // 添加超时处理
          if (!response.ok) {
            const error = await response.json();
            console.error('Notion API error:', error);
            
            switch(error.code) {
              case 'unauthorized':
                throw new Error('Token 无效或已过期，请重新输入');
              case 'restricted_resource':
                throw new Error('无访问权限，请确保已将集成添加到数据库');
              case 'rate_limited':
                throw new Error('请求过于频繁，请稍后再试');
              default:
                throw new Error(`加载失败：${error.message || '未知错误'}`);
            }
          }

          const data = await response.json();
          console.log('Search response:', data);

          if (!data.results) {
            throw new Error('无法获取数据库列表');
          }

          // 过滤出数据库
          const databases = data.results.filter(item => item.object === 'database');
          console.log('Found databases:', databases);

          if (databases.length === 0) {
            throw new Error('未找到可用数据库。请确保：\n1. 已添加集成到数据库\n2. 数据库有写入权限');
          }

          // 验证成功后更新界面
          this.showSuccess('Token 验证成功！');
          setTimeout(() => {
            this.showSaveInterface();
            this.updatePageSelector(databases);
          }, 1000);

        } catch (error) {
          if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            throw new Error('网络错误，请检查网络连接');
          }
          throw error;
        }
      } catch (error) {
        console.error('Load workspaces error:', error);
        this.showError(error.message);
        
        // 如果是认证错误，显示 Token 输入界面
        if (error.message.includes('Token 无效') || error.message.includes('无访问权限')) {
          setTimeout(() => this.showTokenInput(), 2000);
        }
      }
    } catch (error) {
      console.error('Error in loadWorkspaces:', error);
      this.showError(error.message);
    }
  }

  updatePageSelector(pages) {
    if (!this.pageSelect) return;
    
    this.pageSelect.disabled = true;
    this.pageSelect.innerHTML = '<option value="">请选择保存位置...</option>';
    
    pages.forEach(page => {
      const option = document.createElement('option');
      option.value = page.id;
      
      // 获页面标题
      let title = '未命名页面';
      if (page.object === 'database') {
        title = page.title[0]?.plain_text || '未命名数据库';
        title = `📋 ${title}`;
      } else {
        if (page.properties?.title?.title?.[0]?.plain_text) {
          title = page.properties.title.title[0].plain_text;
        } else if (page.properties?.Name?.title?.[0]?.plain_text) {
          title = page.properties.Name.title[0].plain_text;
        }
        title = `📄 ${title}`;
      }
      
      option.textContent = title;
      
      // 如果是上次选择的数据库，设置为选中状态
      if (page.id === this.lastDatabaseId) {
        option.selected = true;
      }
      
      this.pageSelect.appendChild(option);
    });
    this.pageSelect.disabled = false;

    // 添加选择事件监听器
    this.pageSelect.addEventListener('change', async (e) => {
      const selectedId = e.target.value;
      if (selectedId && selectedId.includes('-')) {
        // 保存当前选择的数据库 ID
        chrome.storage.local.set({ lastDatabaseId: selectedId });
        
        const token = await this.getStoredToken();
        if (token) {
          await onNotionConnected(token, selectedId);
        }
      }
    });
  }

  async saveCurrentPage() {
    try {
      const token = await this.getStoredToken();
      const pageId = document.getElementById('pageSelect').value;
      
      if (!pageId) {
        this.showError('请选择保存位置', true);
        return;
      }

      this.showLoading('正在保存...');
      
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab);

      // 检查是否是支持的网站
      const url = new URL(tab.url);
      const supportedDomains = [
        'twitter.com',
        'x.com',
        'weixin.qq.com'
      ];
      
      const isSupported = supportedDomains.some(domain => 
        url.hostname.includes(domain)
      );
      
      if (!isSupported) {
        this.showError('当前页面暂不支持提取内容');
        return;
      }

      // 先尝试直接发送消息
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
        if (response && response.success) {
          await this.continueToSave(token, pageId, response);
          return;
        }
      } catch (error) {
        console.log('Initial message failed, will try injecting content script...');
      }

      // 如果直接发送失败，注入并重新加载内容脚本
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 移除旧的内容脚本（如果存在）
          const oldScript = document.querySelector('script[data-source="notionx-content"]');
          if (oldScript) {
            oldScript.remove();
          }
        }
      });

      // 注入新的内容脚本
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scripts/content.js']
      });

      // 等待脚本初始化
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 重新尝试提取内容
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
        console.log('Content extraction response:', response);

        if (!response || !response.success) {
          throw new Error(response?.error || '无法获取页面内容');
        }

        await this.continueToSave(token, pageId, response);
      } catch (error) {
        console.error('Content extraction error:', error);
        this.showError('内容提取失败，请刷新页面后重试');
      }
    } catch (error) {
      console.error('Save error:', error);
      this.showError(error.message || '保存失败，请重试');
    }
  }

  async continueToSave(token, pageId, pageContent) {
    // 检查目标是否是数据库
    const isDatabase = pageId.includes('-');
    console.log('Saving to database:', isDatabase);
    console.log('Page ID:', pageId);
    console.log('Page content to save:', pageContent);

    let saveResponse;
    if (isDatabase) {
      // 首先获取数据库结构
      const dbResponse = await fetch(`https://api.notion.com/v1/databases/${pageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      });
      
      if (!dbResponse.ok) {
        throw new Error('无法获取数据库结构');
      }
      
      const dbInfo = await dbResponse.json();
      console.log('Database structure:', dbInfo);
      
      // 构建属性映射
      const properties = {};
      Object.entries(dbInfo.properties).forEach(([key, prop]) => {
        try {
          // 特别处理类型字段
          if (key === '类型') {
            properties[key] = {
              select: {
                name: pageContent.data.type || '推文'
              }
            };
          } else {
            properties[key] = this.mapProperty(prop.type, key, pageContent);
          }
        } catch (error) {
          console.error(`Error mapping property ${key}:`, error);
          properties[key] = this.getDefaultPropertyValue(prop.type);
        }
      });

      // 构建保存请求
      const saveData = {
        parent: { database_id: pageId },
        properties: properties
      };

      // 如果有封面图片，添加到页面属性中
      if (pageContent.data?.cover) {
        saveData.cover = {
          type: "external",
          external: { url: pageContent.data.cover }
        };
      }

      // 发送保存请求
      saveResponse = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData)
      });

      // 检查保存响应
      const responseData = await saveResponse.json();
      if (!saveResponse.ok) {
        console.error('Save error:', responseData);
        throw new Error(`保存失败：${responseData.message || '��知错误'}`);
      }

      // 获取新创建的页面 ID
      const newPageId = responseData.id;

      // 将每条推文分别写入页面
      const tweets = pageContent.data.content.split('\n\n---\n\n');
      const blocks = [];

      for (const tweet of tweets) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: tweet }
            }]
          }
        });

        // 添加分隔线
        blocks.push({
          object: 'block',
          type: 'divider',
          divider: {}
        });
      }

      // 添加内容到页面
      const contentResponse = await fetch(`https://api.notion.com/v1/blocks/${newPageId}/children`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          children: blocks
        })
      });

      if (!contentResponse.ok) {
        const error = await contentResponse.json();
        throw new Error(`内容添加失败: ${error.message || '未知错误'}`);
      }

      this.showSuccess('保存成功！3秒后自动关闭');
      setTimeout(() => {
        window.close();
      }, 3000);
    }
    
    // ... 其他代码保持不变 ...
  }

  async getStoredToken() {
    const data = await chrome.storage.local.get('notion_token');
    return data.notion_token;
  }

  showError(message, autoHide = false) {
    if (this.statusDiv) {
      this.statusDiv.innerHTML = `
        <div style="color: #ff4d4f; margin-bottom: 8px;">${message}</div>
        <button id="retryAuth" class="retry-button">重新输入 Token</button>
      `;
      
      document.getElementById('retryAuth')?.addEventListener('click', () => {
        this.showTokenInput();
      });

      if (autoHide) {
        setTimeout(() => {
          this.statusDiv.textContent = '';
        }, 3000);
      }
    }
  }

  showSuccess(message) {
    if (this.statusDiv) {
      this.statusDiv.textContent = message;
      this.statusDiv.style.color = '#52c41a';
    }
  }

  showLoading(message) {
    if (this.statusDiv) {
      this.statusDiv.textContent = message;
      this.statusDiv.style.color = '#1890ff';
    }
  }

  submitToken() {
    const tokenInput = document.getElementById('tokenInput');
    if (!tokenInput) {
      this.showError('找不到输入框');
      return;
    }

    const token = tokenInput.value.trim();
    console.log('Submitting token:', token);

    if (!token) {
      this.showError('请输入 Token');
      return;
    }

    if (!token.startsWith('ntn_')) {
      this.showError('请输入正确的 Integration Token（以 ntn_ 开头）');
      return;
    }

    this.showLoading('正在验证 Token...');
    
    // 保存 token 并加载工作区
    chrome.storage.local.set({ 'notion_token': token }, async () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving token:', chrome.runtime.lastError);
        this.showError('保存 Token 失败');
        return;
      }
      
      // 等待一小段时间确保 token 已保存
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.loadWorkspaces();
    });
  }

  getDefaultPropertyValue(type) {
    switch (type) {
      case 'title':
        return {
          title: [{ text: { content: '' } }]
        };
      case 'rich_text':
        return {
          rich_text: [{ type: 'text', text: { content: '' } }]
        };
      case 'url':
        return {
          url: null
        };
      case 'number':
        return {
          number: 0
        };
      case 'select':
        return {
          select: null
        };
      case 'multi_select':
        return {
          multi_select: []
        };
      case 'date':
        return {
          date: null
        };
      case 'people':
        return {
          people: []
        };
      case 'files':
        return {
          files: []
        };
      case 'checkbox':
        return {
          checkbox: false
        };
      case 'email':
        return {
          email: null
        };
      case 'phone_number':
        return {
          phone_number: null
        };
      case 'status':
        return {
          status: null
        };
      case 'relation':
        return {
          relation: []
        };
      case 'created_time':
        return {
          created_time: new Date().toISOString()
        };
      case 'last_edited_time':
        return {
          last_edited_time: new Date().toISOString()
        };
      default:
        console.warn(`Unknown property type: ${type}`);
        return null;
    }
  }

  async extractContent(tab) {
    try {
      console.log('Checking if content script is loaded...');
      
      // 先尝试直接送消息
      try {
        console.log('Sending message to content script...');
        let content = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
        if (content) {
          console.log('Content extracted successfully:', content);
          return content;
        }
      } catch (e) {
        console.log('Initial message failed, injecting content script...');
      }

      // 如果直接发送失败，注入脚本并重试
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scripts/content.js']
      });

      // 等待一下让脚本初始化
      await new Promise(resolve => setTimeout(resolve, 500));

      // 重新发送消息
      console.log('Retrying message after script injection...');
      let content = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      
      if (!content) {
        throw new Error('无法获取页面内容');
      }

      console.log('Content extracted:', content);
      return content;
    } catch (error) {
      console.error('Content extraction error:', error);
      // 检查是否是在 Twitter 页面上
      const tabInfo = await chrome.tabs.get(tab.id);
      if (!tabInfo.url.includes('twitter.com')) {
        throw new Error('请在 Twitter 页面上使用此功能');
      }
      throw new Error('无法获取页面内容，请刷新页面后重试');
    }
  }

  mapProperty(type, key, pageContent) {
    const data = pageContent.data || {};
    
    // 特殊处理 Created 字段
    if (key === 'Created') {
      return {
        date: {
          start: new Date().toISOString()
        }
      };
    }

    // 特殊处理标签字段
    if (key === '标签') {
      return {
        multi_select: []  // 返回空数组，让用户后续手动添加标签
      };
    }

    // 然后根据具体字段进行特殊处理
    switch (key) {
      case '标题':
        return {
          title: [{ text: { content: data.title || '' } }]
        };
      case '内容':
        return {
          rich_text: [{
            text: {
              content: (data.content || '').substring(0, 2000)
            }
          }]
        };
      case '作者':
        let author = '';
        if (data.url) {
          // 从 URL 中取作者名
          const matches = data.url.match(/(?:twitter|x)\.com\/([^/]+)/);
          if (matches && matches[1]) {
            author = '@' + matches[1];
          }
        }
        return {
          rich_text: [{
            text: {
              content: author || data.author || ''
            }
          }]
        };
      case '链接':
        return {
          url: data.url || null
        };
      case '评论数':
        return {
          number: data.stats?.comments || 0
        };
      case '转发数':
        return {
          number: data.stats?.retweets || 0
        };
      case '点赞数':
        return {
          number: data.stats?.likes || 0
        };
      case '收藏数':
        return {
          number: data.stats?.bookmarks || 0
        };
      case '主推文浏览量':
        return {
          rich_text: [{
            text: {
              content: data.stats?.views || ''
            }
          }]
        };
      case '第二条推文浏览量':
        return {
          rich_text: [{
            text: {
              content: data.stats?.second_views?.toString() || ''
            }
          }]
        };
      case '发推时间':
        // 将 ISO 时间字符串转换为更友好的格式
        let formattedTime = '';
        if (data.stats?.created_time) {
          const date = new Date(data.stats.created_time);
          formattedTime = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }
        return {
          rich_text: [{
            text: {
              content: formattedTime
            }
          }]
        };
      case '推文开头':
        // 处理文本：去掉多余空行但保留换行
        const processedContent = (data.firstTweet || '')
          .split('\n')                    // 按换行符分割
          .filter(line => line.trim())    // 去掉空行
          .join('\n');                    // 重新组合

        return {
          title: [{
            text: {
              content: processedContent
            }
          }]
        };
      default:
        // 对于其他字段，返回对应类型的认值
        switch (type) {
          case 'title':
            return {
              title: [{ text: { content: '' } }]
            };
          case 'rich_text':
            return {
              rich_text: [{ text: { content: '' } }]
            };
          case 'url':
            return {
              url: null
            };
          case 'number':
            return {
              number: 0
            };
          case 'select':
            return {
              select: null
            };
          case 'multi_select':
            return {
              multi_select: []
            };
          case 'date':
            return {
              date: null
            };
          case 'people':
            return {
              people: []
            };
          case 'files':
            return {
              files: []
            };
          case 'checkbox':
            return {
              checkbox: false
            };
          case 'email':
            return {
              email: null
            };
          case 'phone_number':
            return {
              phone_number: null
            };
          case 'status':
            return {
              status: null
            };
          case 'relation':
            return {
              relation: []
            };
          case 'created_time':
            return {
              created_time: new Date().toISOString()
            };
          case 'last_edited_time':
            return {
              last_edited_time: new Date().toISOString()
            };
          default:
            console.warn(`Unknown property type: ${type} for key: ${key}`);
            return null;
        }
    }
  }

  // 添加新方法：加载上次选择的数据库
  async loadLastSelectedDatabase() {
    try {
      const { lastDatabaseId } = await chrome.storage.local.get('lastDatabaseId');
      this.lastDatabaseId = lastDatabaseId;
    } catch (error) {
      console.error('Error loading last database:', error);
    }
  }
}

// 在成功连接 Notion 后
async function onNotionConnected(token, databaseId) {
  try {
    // 保存凭证
    await chrome.storage.local.set({ token, databaseId });
    
    // 通知 background.js 更新数据库 schema
    const response = await chrome.runtime.sendMessage({
      action: 'notionConnected',
      data: { token, databaseId }
    });
    
    if (!response.success) {
      console.error('Failed to update database schema:', response.error);
      // 可以选��是否向用户显示错误信息
    }
  } catch (error) {
    console.error('Error in onNotionConnected:', error);
  }
}

// 确保 DOM 完全加载后再初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing NotionAuth');
  window.notionAuth = new NotionAuth();
}); 

// 添加请求限制处理工具
class RateLimiter {
  constructor(requestsPerSecond = 3) {
    this.requestsPerSecond = requestsPerSecond;
    this.queue = [];
    this.processing = false;
  }

  async request(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    this.processing = true;
    while (this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        if (error.code === 'rate_limited') {
          const retryAfter = parseInt(error.headers.get('Retry-After') || '5');
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          this.queue.unshift({ fn, resolve, reject });
          continue;
        }
        reject(error);
      }
      await new Promise(resolve => setTimeout(resolve, 1000 / this.requestsPerSecond));
    }
    this.processing = false;
  }
} 