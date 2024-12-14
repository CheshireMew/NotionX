async function saveToNotion(token, pageId, content) {
  let blocks = [];
  
  if (Array.isArray(content)) {
    // Twitter 线程
    blocks = content.map(tweet => ({
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
    // 普通网页
    blocks = [
      {
        object: 'block',
        type: 'bookmark',
        bookmark: {
          url: content.url
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: content.content }
          }]
        }
      }
    ];
  }

  const response = await fetch('https://api.notion.com/v1/blocks/' + pageId + '/children', {
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
  
  return response.json();
} 