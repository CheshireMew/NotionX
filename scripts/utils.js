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