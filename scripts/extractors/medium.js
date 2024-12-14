// Medium 提取器示例
class MediumExtractor extends BaseContentExtractor {
  canHandle() {
    return window.location.hostname.includes('medium.com');
  }

  async _extract() {
    // 提取标题
    const titleElement = await this.waitForElement('h1');
    this.content.title = titleElement?.textContent?.trim() || '';

    // 提取作者
    const authorElement = await this.waitForElement('[data-testid="authorName"]');
    this.content.author = authorElement?.textContent?.trim() || '';

    // 提取内容
    const articleElement = await this.waitForElement('article');
    if (articleElement) {
      this.content.content = this.extractArticleContent(articleElement);
    }

    // 提取封面图
    const coverImage = await this.waitForElement('article img');
    if (coverImage?.src) {
      this.content.cover = coverImage.src;
    }

    // 设置类型
    this.content.type = '文章';

    // 提取统计数据
    // ... Medium 特定的统计数据提取逻辑
  }

  extractArticleContent(article) {
    // Medium 特定的内容提取逻辑
    // ...
  }
} 