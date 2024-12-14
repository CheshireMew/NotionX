const CLIENT_ID = '您的client_id'; // 从 Notion 开发者页面获取
const CLIENT_SECRET = '您的client_secret'; // 从 Notion 开发者页面获取
const REDIRECT_URI = chrome.runtime.getURL('oauth.html');

class NotionAuth {
  constructor() {
    this.connectButton = document.getElementById('connectNotion');
    this.saveButton = document.getElementById('saveToNotion');
    this.statusDiv = document.getElementById('status');
    this.pageSelector = document.getElementById('page-selector');
    
    this.init();
  }

  async init() {
    const token = await this.getStoredToken();
    if (token) {
      this.showSaveInterface();
      this.loadWorkspaces();
    } else {
      this.showConnectInterface();
    }
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.connectButton.addEventListener('click', () => this.authorize());
    this.saveButton.addEventListener('click', () => this.saveCurrentPage());
  }

  showConnectInterface() {
    if (this.connectButton) {
      this.connectButton.style.display = 'block';
    }
    if (this.saveButton) {
      this.saveButton.style.display = 'none';
    }
    if (this.pageSelector) {
      this.pageSelector.style.display = 'none';
    }
  }

  showSaveInterface() {
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

  async loadWorkspaces() {
    const token = await this.getStoredToken();
    if (!token) return;

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
            value: 'page'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to load pages');
      }

      const data = await response.json();
      console.log('Notion response:', data); // 添加调试日志
      this.updatePageSelector(data.results);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      this.showError('加载页面失败，请检查 Token 是否正确');
    }
  }

  updatePageSelector(pages) {
    const select = document.getElementById('pageSelect');
    select.innerHTML = '<option value="">请选择保存位置...</option>';
    
    if (pages && pages.length > 0) {
      pages.forEach(page => {
        const option = document.createElement('option');
        option.value = page.id;
        
        // 获取页面标题
        let title = '未命名页面';
        if (page.properties?.title?.title?.[0]?.plain_text) {
          title = page.properties.title.title[0].plain_text;
        } else if (page.properties?.Name?.title?.[0]?.plain_text) {
          title = page.properties.Name.title[0].plain_text;
        }
        
        option.textContent = title;
        select.appendChild(option);
      });
    } else {
      this.showError('未找到可用页面，请确保已分享权限给集成');
    }
  }

  async saveCurrentPage() {
    const token = await this.getStoredToken();
    const pageId = document.getElementById('pageSelect').value;
    
    if (!pageId) {
      this.statusDiv.textContent = '请选择保存位置';
      return;
    }

    this.statusDiv.textContent = '正在保存...';
    
    try {
      // 获取当前标签页的内容
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      
      if (!response) {
        throw new Error('无法获取页面内容');
      }

      // 根据内容类型构建不同的保存格式
      let blocks = [];
      if (response.type === 'twitter') {
        blocks = response.content.map(tweet => ({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: tweet }
            }]
          }
        }));
      } else {
        blocks = [
          {
            object: 'block',
            type: 'bookmark',
            bookmark: {
              url: response.content.url
            }
          },
          {
            object: 'block',
            type: 'heading_1',
            heading_1: {
              rich_text: [{
                type: 'text',
                text: { content: response.content.title }
              }]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{
                type: 'text',
                text: { content: response.content.content }
              }]
            }
          }
        ];
      }

      // 保存到 Notion
      const saveResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
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

      if (!saveResponse.ok) {
        throw new Error('保存失败');
      }

      this.statusDiv.textContent = '保存成功！';
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (error) {
      console.error('Save error:', error);
      this.statusDiv.textContent = '保存失败，请重试';
    }
  }

  async getStoredToken() {
    const data = await chrome.storage.local.get('notion_token');
    return data.notion_token;
  }

  showError(message) {
    if (this.statusDiv) {
      this.statusDiv.textContent = message;
      this.statusDiv.style.color = '#ff4d4f';
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

  async authorize() {
    const authUrl = 'https://api.notion.com/v1/oauth/authorize?' + new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      owner: 'user',
      redirect_uri: REDIRECT_URI
    });
    
    try {
      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      
      const code = new URL(redirectUrl).searchParams.get('code');
      if (code) {
        await this.exchangeCodeForToken(code);
        this.showSaveInterface();
        this.loadWorkspaces();
      }
    } catch (error) {
      console.error('Auth error:', error);
      this.statusDiv.textContent = '授权失败，请重试';
    }
  }

  async exchangeCodeForToken(code) {
    try {
      const response = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET
        })
      });

      const data = await response.json();
      if (data.access_token) {
        await chrome.storage.local.set({ 
          'notion_token': data.access_token,
          'workspace_id': data.workspace_id
        });
      }
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new NotionAuth();
}); 