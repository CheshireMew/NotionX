(function loadWechatExtractor() {
  console.log('[Wechat] Loading WechatExtractor...');

  // 等待基类加载
  if (!window.BaseContentExtractor) {
    console.log('[Wechat] Waiting for BaseContentExtractor...');
    setTimeout(loadWechatExtractor, 50);
    return;
  }

  class WechatExtractor extends window.BaseContentExtractor {
    canHandle() {
      const hostname = window.location.hostname;
      return hostname.includes('weixin.qq.com') && window.location.pathname.startsWith('/s/');
    }

    async _extract() {
      try {
        console.log('Starting Wechat content extraction');

        // 提取标题
        const titleElement = document.getElementById('activity-name');
        this.content.title = titleElement ? titleElement.textContent.trim() : '';

        // 提取作者
        const authorElement = document.getElementById('js_name');
        this.content.author = authorElement ? authorElement.textContent.trim() : '';

        // 提取发布时间
        const timeElement = document.getElementById('publish_time');
        if (timeElement) {
          this.content.stats.created_time = timeElement.textContent.trim();
        }

        // 提取正文内容
        const contentElement = document.getElementById('js_content');
        if (contentElement) {
          // 清理内容
          this.content.content = this.cleanContent(contentElement);
        }

        // 提取封面图
        const coverImg = document.querySelector('#js_content img');
        if (coverImg) {
          this.content.cover = coverImg.getAttribute('data-src') || coverImg.src;
        }

        // 设置类型
        this.content.type = '公众号文章';
        
        // 设置当前URL
        this.content.url = window.location.href;

        return true;
      } catch (error) {
        console.error('Error in _extract:', error);
        throw error;
      }
    }

    cleanContent(contentElement) {
      // 创建副本以避免修改原始DOM
      const content = contentElement.cloneNode(true);
      
      // 处理图片链接
      content.querySelectorAll('img').forEach(img => {
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) {
          img.src = dataSrc;
        }
      });

      // 移除不需要的元素
      content.querySelectorAll('script, style').forEach(el => el.remove());

      // 返回清理后的HTML内容
      return content.innerHTML.trim();
    }
  }

  window.WechatExtractor = WechatExtractor;
  console.log('[Wechat] WechatExtractor loaded successfully');
})(); 