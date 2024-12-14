// Twitter 线程提取器
class TwitterThreadExtractor {
  extractThread() {
    if (!window.location.hostname.includes('twitter.com')) {
      return null;
    }

    const tweets = [];
    
    // 获取主推文
    const mainTweet = document.querySelector('[data-testid="tweetText"]');
    if (mainTweet) {
      tweets.push(this.formatTweetText(mainTweet));
    }

    // 获取回复推文
    const replies = document.querySelectorAll('[data-testid="tweet"]');
    replies.forEach(reply => {
      const tweetText = reply.querySelector('[data-testid="tweetText"]');
      if (tweetText) {
        tweets.push(this.formatTweetText(tweetText));
      }
    });

    return tweets;
  }

  formatTweetText(element) {
    // 处理表情符号和图片
    const text = Array.from(element.childNodes)
      .map(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent;
        }
        if (node.tagName === 'IMG') {
          return node.alt || '';
        }
        return node.textContent;
      })
      .join('');

    return text.trim();
  }
}

// 通用网页内容提取器
class WebPageExtractor {
  extract() {
    return {
      title: document.title,
      url: window.location.href,
      content: document.body.innerText
    };
  }
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    const twitterExtractor = new TwitterThreadExtractor();
    const webExtractor = new WebPageExtractor();
    
    const twitterContent = twitterExtractor.extractThread();
    const webContent = webExtractor.extract();
    
    sendResponse({
      type: twitterContent ? 'twitter' : 'webpage',
      content: twitterContent || webContent
    });
  }
}); 