class NotionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'NotionError';
    this.code = code;
  }
}

export const ErrorMessages = {
  NO_TOKEN: '请先连接到 Notion',
  NO_PAGE: '请选择保存位置',
  EXTRACT_FAILED: '无法获取页面内容',
  SAVE_FAILED: '保存失败，请重试',
  AUTH_FAILED: '授权失败，请重试',
  NETWORK_ERROR: '网络错误，请检查连接',
};

export const handleError = (error, statusDiv) => {
  console.error(error);
  
  if (error instanceof NotionError) {
    statusDiv.textContent = error.message;
  } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
    statusDiv.textContent = ErrorMessages.NETWORK_ERROR;
  } else {
    statusDiv.textContent = ErrorMessages.SAVE_FAILED;
  }
  
  statusDiv.style.color = '#ff4d4f';
};

export const showMessage = (element, message, type = 'info') => {
  if (!element) return;
  
  const colors = {
    success: '#52c41a',
    error: '#ff4d4f',
    info: '#1890ff',
    warning: '#faad14'
  };
  
  element.textContent = message;
  element.style.color = colors[type];
};

export const utils = {
  debounce(fn, delay) {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  async retry(fn, maxRetries = 3, delay = 1000) {
    try {
      return await fn();
    } catch (error) {
      if (maxRetries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retry(fn, maxRetries - 1, delay);
      }
      throw error;
    }
  },

  validateToken(token) {
    return typeof token === 'string' && token.startsWith('ntn_');
  },

  handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    return {
      success: false,
      error: error.message || '未知错误',
      context
    };
  }
};

// 添加日志工具
export class Logger {
  static levels = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  };

  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    console[level](JSON.stringify(logEntry));

    // 可以添加发送到远程日志服务的逻辑
  }
} 