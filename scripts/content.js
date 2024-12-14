// 加载所需的提取器
const extractors = [
  'scripts/extractors/base.js',
  'scripts/extractors/twitter.js',
  'scripts/extractors/wechat.js'
];

// 立即执行的初始化函数
(function() {
  console.log('Content script loaded for:', window.location.href);
  
  // 标记脚本来源
  const script = document.currentScript;
  if (script) {
    script.dataset.source = 'notionx-content';
  }

  // 确保只初始化一次
  if (window.extractorInitialized) {
    console.log('Extractor already initialized');
    return;
  }
  window.extractorInitialized = true;

  // 初始化提取器
  function initializeExtractor() {
    console.log('Initializing content extractor...');
    
    // 监听来自 popup 的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content script received message:', request);
      
      if (request.action === 'extractContent') {
        (async () => {
          try {
            console.log('Starting content extraction...');
            
            // 获取可用的提取器类
            const extractorClasses = [];
            if (window.TwitterExtractor) extractorClasses.push(window.TwitterExtractor);
            if (window.WechatExtractor) extractorClasses.push(window.WechatExtractor);
            
            if (extractorClasses.length === 0) {
              console.error('No extractors available');
              sendResponse({
                success: false,
                error: '提取器未正确加载'
              });
              return;
            }

            // 找到第一个可以处理当前页面的提取器
            let extractor = null;
            for (const ExtractorClass of extractorClasses) {
              const tempExtractor = new ExtractorClass();
              if (tempExtractor.canHandle()) {
                extractor = tempExtractor;
                break;
              }
            }
            
            if (!extractor) {
              console.log('No suitable extractor found for this page');
              sendResponse({
                success: false,
                error: '当前页面暂不支持提取内容'
              });
              return;
            }

            const result = await extractor.extract();
            console.log('Extraction result:', result);
            
            if (!result) {
              sendResponse({
                success: false,
                error: '无法提取内容'
              });
              return;
            }

            sendResponse(result);
          } catch (error) {
            console.error('Content extraction error:', error);
            sendResponse({
              success: false,
              error: error.message || '内容提取失败'
            });
          }
        })();
        return true; // 保持消息通道开启
      }
    });
  }

  // 等待 DOM 加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtractor);
  } else {
    initializeExtractor();
  }
})();

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
      type: 'twitter',
      stats: {
        views: 0,
        second_views: 0,
        bookmarks: 0,
        likes: 0,
        comments: 0,
        retweets: 0,
        created_time: ''
      }
    };
  }

  canHandle() {
    return false;
  }

  extract() {
    return null;
  }
}

// Twitter 内容提取器
class TwitterExtractor extends BaseContentExtractor {
  canHandle() {
    const isTwitter = window.location.hostname.includes('twitter.com') || 
                      window.location.hostname.includes('x.com');
    console.log('Checking if can handle:', window.location.hostname, isTwitter);
    return isTwitter;
  }

  // 添加辅助方法
  async waitForElement(selector, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  async scrollToBottom() {
    return new Promise(resolve => {
      let lastHeight = document.documentElement.scrollHeight;
      let noChangeCount = 0;
      const maxNoChange = 2;
      
      const smoothScroll = async () => {
        const currentScroll = window.scrollY;
        const targetScroll = Math.min(
          currentScroll + 2000,
          document.documentElement.scrollHeight - window.innerHeight
        );
        
        await new Promise(scrollResolve => {
          window.scrollTo({
            top: targetScroll,
            behavior: 'auto'
          });
          setTimeout(scrollResolve, 50);
        });

        const newHeight = document.documentElement.scrollHeight;
        
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 100) {
          noChangeCount++;
          if (noChangeCount >= maxNoChange) {
            console.log('Reached bottom or no more content');
            resolve();
            return;
          }
        } else if (newHeight !== lastHeight) {
          noChangeCount = 0;
          lastHeight = newHeight;
        }

        smoothScroll();
      };

      smoothScroll();

      setTimeout(() => {
        console.log('Reached maximum scroll time');
        resolve();
      }, 5000);
    });
  }

  // 修改平滑滚动函数
  async smoothScrollTo(target, duration = 200) {
    try {
      const start = window.pageYOffset;
      let end;
      
      if (typeof target === 'number') {
        // 如果传入的是数字，直接作为滚动距离
        end = start + target;
      } else if (target && target.getBoundingClientRect) {
        // 如果传入的是 DOM 元素
        end = target.getBoundingClientRect().top + start;
      } else {
        console.error('Invalid scroll target:', target);
        return;
      }

      // 使用原生的平滑滚动
      window.scrollTo({
        top: end,
        behavior: 'smooth'
      });

      // 等待滚动完成
      return new Promise(resolve => setTimeout(resolve, duration));
    } catch (error) {
      console.error('Smooth scroll error:', error);
      // 如果出错，使用简单的滚动
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return new Promise(resolve => setTimeout(resolve, duration));
    }
  }

  async extractThread() {
    try {
      console.log('Starting extractThread...');
      
      // 检查 this 和 this.content
      if (!this) {
        console.error('this is undefined');
        return { tweets: [], mainTweet: null };
      }
      console.log('this.content:', this.content);

      // 先获取主推文
      const mainTweet = await this.waitForElement('article[data-testid="tweet"]');
      if (!mainTweet) {
        console.error('Main tweet not found');
        return { tweets: [], mainTweet: null };
      }
      console.log('Found main tweet:', mainTweet);

      // 提取作者信息
      const authorLink = mainTweet.querySelector('[data-testid="User-Name"] a[role="link"]');
      if (!authorLink) {
        console.error('Author link not found');
        return { tweets: [], mainTweet: null };
      }

      // 获取作者的 handle
      const authorHandle = authorLink.getAttribute('href').substring(1);
      this.content.author = '@' + authorHandle;
      console.log('Found author:', this.content.author);

      const threadContent = [];
      let currentTweet = mainTweet;
      let retryCount = 0;
      const MAX_RETRIES = 3;
      const MAX_SCROLL_ATTEMPTS = 10;
      let scrollAttempts = 0;
      let noMoreTweetsCount = 0;  // 添加计数器来跟踪连续未找到新推文的次数
      const MAX_NO_TWEETS = 2;    // 设置最大连续未找到新推文的次数

      // 循环提取每条推文
      while (currentTweet && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
        try {
          const tweetAuthorLink = currentTweet.querySelector('[data-testid="User-Name"] a[role="link"]');
          const tweetAuthorHandle = tweetAuthorLink?.getAttribute('href')?.substring(1);
            
          // 如果找不到作者信息，重试几次
          if (!tweetAuthorHandle) {
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }
            console.log('Could not find author info after retries');
            break;
          }

          // 如果发现非作者的推文，结束采集
          if (tweetAuthorHandle !== authorHandle) {
            console.log(`Thread ends: Found non-author tweet (${tweetAuthorHandle} != ${authorHandle})`);
            break;
          }

          // 重置重试计数
          retryCount = 0;

          // 提取推文内容
          const tweetText = currentTweet.querySelector('[data-testid="tweetText"]');
          if (tweetText) {
            const textContent = Array.from(tweetText.childNodes)
              .map(node => {
                if (!node) return '';
                if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
                if (node.tagName === 'IMG') return node.alt || '';
                if (node.tagName === 'BR' || node.tagName === 'DIV') return '\n';
                return node.textContent || '';
              })
              .join('')
              .trim();

            // 添加重复内容检查
            if (textContent && !threadContent.includes(textContent)) {
              threadContent.push(textContent);
              console.log(`Extracted tweet ${threadContent.length}:`, textContent);
            } else {
              console.log('Skipping duplicate tweet content');
            }
          }

          // 滚动到当前推文底部
          await this.smoothScrollTo(currentTweet.offsetTop + currentTweet.offsetHeight);
          await new Promise(resolve => setTimeout(resolve, 500));

          // 获取所有可见的推文
          const tweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          const currentIndex = tweets.indexOf(currentTweet);
          
          if (currentIndex === -1) {
            console.log('Current tweet not found in visible tweets');
            scrollAttempts++;
            await this.smoothScrollTo(window.scrollY + window.innerHeight / 2);
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }

          // 检查是否还有下一条推文
          const nextTweet = tweets[currentIndex + 1];
          if (!nextTweet) {
            // 如果没有下一条推文，尝试滚动加载更多
            noMoreTweetsCount++;
            if (noMoreTweetsCount >= MAX_NO_TWEETS) {
              console.log('No more tweets found after multiple attempts');
              break;
            }
            await this.smoothScrollTo(window.scrollY + window.innerHeight);
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }

          // 检查下一条推文是否属于同一作者
          const nextAuthorLink = nextTweet.querySelector('[data-testid="User-Name"] a[role="link"]');
          const nextAuthorHandle = nextAuthorLink?.getAttribute('href')?.substring(1);

          if (!nextAuthorHandle || nextAuthorHandle !== authorHandle) {
            console.log(`Thread ends: Next tweet is not from the same author (${nextAuthorHandle} != ${authorHandle})`);
            break;
          }

          // 找到作者的新推文，重置计数器
          noMoreTweetsCount = 0;
          currentTweet = nextTweet;
          scrollAttempts = 0;

        } catch (error) {
          console.error('Error processing tweet:', error);
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          break;
        }
      }

      console.log(`Thread extraction complete. Found ${threadContent.length} tweets`);
      return { tweets: threadContent, mainTweet };

    } catch (error) {
      console.error('Error in extractThread:', error);
      return { tweets: [], mainTweet: null };
    }
  }

  // 修改 extract 方法为异步
  async extract() {
    console.log('Starting Twitter content extraction');
    
    if (!this.canHandle()) {
      console.log('Not a Twitter page');
      return null;
    }

    try {
      // 取线程内容
      console.log('Starting to extract thread...');
      const { tweets: threadContent, mainTweet } = await this.extractThread();
      
      if (threadContent.length === 0 || !mainTweet) {
        console.log('No thread content found');
        return null;
      }

      // 设置主推文为题
      this.content.title = threadContent[0];
      this.content.firstTweet = threadContent[0];
      this.content.content = threadContent.join('\n\n---\n\n');

      // 提取基本信息
      this.content.url = window.location.href;
      
      // 自动判断类型
      this.content.type = this.determinePostType(mainTweet, threadContent);

      // 提取计数据
      const metrics = {
        reply: '[data-testid="reply"]',
        retweet: '[data-testid="retweet"]',
        like: '[data-testid="like"]',
        bookmark: '[data-testid="bookmark"]'
      };

      Object.entries(metrics).forEach(([key, selector]) => {
        const element = mainTweet.querySelector(selector);
        if (element) {
          const valueElement = element.querySelector('[data-testid="app-text-transition-container"]');
          const value = valueElement ? 
            parseInt(valueElement.textContent.replace(/,/g, ''), 10) || 0 : 0;

          switch (key) {
            case 'reply':
              this.content.stats.comments = value;
              break;
            case 'retweet':
              this.content.stats.retweets = value;
              break;
            case 'like':
              this.content.stats.likes = value;
              break;
            case 'bookmark':
              this.content.stats.bookmarks = value;
              break;
          }
        }
      });

      // 提取览量 - 使用 XPath
      const getElementByXPath = (xpath) => {
        return document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
      };

      // 提取主推文浏览量
      const viewsXPath = '/html/body/div[1]/div/div/div[2]/main/div/div/div/div/div/section/div/div/div[1]/div/div/article/div/div/div[3]/div[4]/div/div[1]/div/div[3]/span/div/span/span/span';
      const viewsElement = getElementByXPath(viewsXPath);
      if (viewsElement && viewsElement.textContent.includes('查看')) {
        const viewsText = viewsElement.textContent.replace('查看', '').trim();
        this.content.stats.views = viewsText;
        console.log('Extracted views:', viewsText);
      } else {
        console.log('Views element not found with XPath');
        // 尝试其他方法
        const viewsSpans = mainTweet.querySelectorAll('span');
        for (const span of viewsSpans) {
          if (span.textContent.includes('查看')) {
            const viewsText = span.textContent.replace('查看', '').trim();
            this.content.stats.views = viewsText;
            console.log('Extracted views (fallback):', viewsText);
            break;
          }
        }
      }

      // 提取第二条推文浏览量
      const secondTweet = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))[1];
      if (secondTweet) {
        const secondViewsSpans = secondTweet.querySelectorAll('span');
        for (const span of secondViewsSpans) {
          if (span.textContent.includes('查看')) {
            this.content.stats.second_views = span.textContent.replace('查看', '').trim();
            console.log('Extracted second tweet views:', this.content.stats.second_views);
            break;
          }
        }
      }

      // 提取图片
      const imageContainer = mainTweet.querySelector('[data-testid="tweetPhoto"]');
      if (imageContainer) {
        const img = imageContainer.querySelector('img');
        if (img && img.src) {
          this.content.cover = img.src;
        }
      }

      // 提取发推时间
      const timeElement = mainTweet.querySelector('time');
      if (timeElement) {
        this.content.stats.created_time = timeElement.getAttribute('datetime');
        console.log('Extracted tweet time:', this.content.stats.created_time);
      }

      // 移除标签提取相关代码
      this.content.tags = []; // 保持标签数组为空

      console.log('Extraction complete:', this.content);
      return {
        success: true,
        data: this.content
      };
    } catch (error) {
      console.error('Error during extraction:', error);
      return {
        success: false,
        error: error.message || '提取失败'
      };
    }
  }

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

  parseViews(viewsText) {
    if (!viewsText) return 0;
    
    // 处理带"万"的数字
    if (viewsText.includes('万')) {
      const numStr = viewsText.replace('万', '');
      const num = parseFloat(numStr);
      return Math.round(num * 10000); // 换为实际字
    }
    
    // 处理普通数字（可能包含逗号）
    return parseInt(viewsText.replace(/,/g, ''), 10) || 0;
  }
}

function getTweetData() {
    const article = document.querySelector('article[data-testid="tweet"]');
    if (!article) return null;

    // 获取推文基本信息
    const tweetData = {
        author: getAuthorInfo(article),
        full_text: getTweetText(article),
        mediaItems: getMediaItems(article),
        conversation_thread: getConversationThread(article),
        created_at: getTweetTimestamp(article),
        metrics: getTweetMetrics(article)
    };

    // 自动判断类型
    tweetData.type = determinePostType(tweetData);

    return tweetData;
}

function determinePostType(tweetData) {
    // 检查是否有子线程
    if (tweetData.conversation_thread && tweetData.conversation_thread.length > 0) {
        return "程";
    }
    
    // 检查是否只有图片没有文本
    if (tweetData.mediaItems && tweetData.mediaItems.length > 0 && 
        (!tweetData.full_text || tweetData.full_text.trim() === '')) {
        return "图片";
    }
    
    // 默认为推文
    return "推文";
}

function getConversationThread(article) {
    // 获取当前推文下所有子线程推文
    const threadTweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
        .filter(tweet => tweet !== article && tweet.closest('[aria-label*="会话"]'));
    
    return threadTweets.map(tweet => ({
        text: getTweetText(tweet),
        author: getAuthorInfo(tweet),
        created_at: getTweetTimestamp(tweet)
    }));
}

// 辅助函数：检查元素是否在视口中
function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// ... 其他辅助函数保持不变 ... 

// 添加错误处理和重试机制
class ContentExtractor {
  static MAX_RETRIES = 3;
  static RETRY_DELAY = 1000;

  static async extract(retries = this.MAX_RETRIES) {
    try {
      return await this._doExtract();
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.extract(retries - 1);
      }
      throw error;
    }
  }

  static async _doExtract() {
    // 现有的提取逻辑
  }
}