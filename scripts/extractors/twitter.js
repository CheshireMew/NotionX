(function loadTwitterExtractor() {
  console.log('[Twitter] Loading TwitterExtractor...');

  // 等待基类加载
  if (!window.BaseContentExtractor) {
    console.log('[Twitter] Waiting for BaseContentExtractor...');
    setTimeout(loadTwitterExtractor, 50);
    return;
  }

  // Twitter 内容提取器
  class TwitterExtractor extends window.BaseContentExtractor {
    canHandle() {
      const hostname = window.location.hostname;
      return hostname.includes('twitter.com') || hostname.includes('x.com');
    }

    async _extract() {
      try {
        console.log('Starting Twitter content extraction');
        
        // 提取线程内容
        console.log('Starting to extract thread...');
        const { tweets: threadContent, mainTweet } = await this.extractThread();
        
        if (threadContent.length === 0 || !mainTweet) {
          console.log('No thread content found');
          return null;
        }

        // 设置主推文为标题
        this.content.title = threadContent[0];
        this.content.firstTweet = threadContent[0];
        this.content.content = threadContent.join('\n\n---\n\n');
        this.content.url = window.location.href;
        this.content.type = this.determinePostType(mainTweet, threadContent);

        // 提取统计数据
        await this.extractStats(mainTweet);

        return true;
      } catch (error) {
        console.error('Error in _extract:', error);
        throw error;
      }
    }

    // 提取线程内容
    async extractThread() {
      // ... 原有的 extractThread 方法代码 ...
    }

    // 确定推文类型
    determinePostType(mainTweet, threadContent) {
      // 检查是否有子线程（多条推文）
      if (threadContent && threadContent.length > 1) {
        console.log('Type: Thread - Multiple tweets detected:', threadContent.length);
        return "线程";
      }
      
      // 检查是否只有图片没有文本
      const hasText = this.content.firstTweet && this.content.firstTweet.trim().length > 0;
      const hasMedia = mainTweet.querySelector('[data-testid="tweetPhoto"], [data-testid="tweetVideo"]') !== null;
      
      if (hasMedia && !hasText) {
        console.log('Type: Image - Media without text detected');
        return "图片";
      }
      
      // 默认为推文
      console.log('Type: Tweet - Default type');
      return "推文";
    }

    // 提取统计数据
    async extractStats(mainTweet) {
      // ... 原有的统计数据提取代码 ...
    }
  }

  window.TwitterExtractor = TwitterExtractor;
  console.log('[Twitter] TwitterExtractor loaded successfully');
})();