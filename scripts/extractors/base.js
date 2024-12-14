(function loadBaseExtractor() {
  console.log('[Base] Loading BaseContentExtractor...');
  
  // 检查是否已加载
  if (window.BaseContentExtractor) {
    console.log('[Base] BaseContentExtractor already loaded');
    return;
  }

  // 基础内容提取器接口
  class BaseContentExtractor {
    constructor() {
      this.content = {
        title: '',
        content: '',
        url: '',
        cover: '',
        author: '',
        tags: [],
        type: 'article',  // 默认类型改为文章
        stats: {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          created_time: ''
        }
      };
    }

    // 判断是否可以处理当前页面
    canHandle() {
      return false;
    }

    // 提取内容的主方法
    async extract() {
      if (!this.canHandle()) {
        console.log('This extractor cannot handle current page');
        return null;
      }

      try {
        await this._extract();
        return {
          success: true,
          data: this.content
        };
      } catch (error) {
        console.error('Extraction error:', error);
        return {
          success: false,
          error: error.message || '提取失败'
        };
      }
    }

    // 由子类实现的具体提取方法
    async _extract() {
      throw new Error('_extract method must be implemented by subclass');
    }

    // 通用的辅助方法
    async waitForElement(selector, timeout = 5000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const element = document.querySelector(selector);
        if (element) return element;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return null;
    }
  }

  window.BaseContentExtractor = BaseContentExtractor;
  console.log('[Base] BaseContentExtractor loaded successfully');
})(); 