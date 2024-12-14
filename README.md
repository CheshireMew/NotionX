# NotionX

一个将网页内容保存到 Notion 的 Chrome 扩展。

## 设置步骤

1. 访问 [Notion Developers](https://www.notion.so/my-integrations) 创建新的集成
   - 点击 "New integration"
   - Name: NotionX
   - Associated workspace: 选择您的工作区
   - Type: Public integration
   - Capabilities: 确保启用以下权限：
     - Read content
     - Update content
     - Insert content

2. 在集成设置页面：
   - 复制 `OAuth client ID` 并替换 `popup/popup.js` 中的 `CLIENT_ID`
   - 复制 `OAuth client secret` 并替换 `CLIENT_SECRET`
   - 在 "OAuth Domain & URIs" 部分：
     - OAuth domain: chrome-extension://[您的扩展ID]
     - Redirect URIs: chrome-extension://[您的扩展ID]/oauth.html

3. 获取扩展 ID：
   - 在 Chrome 中打开 `chrome://extensions`
   - 启用 "开发者模式"
   - 加载已解压的扩展（选择项目文件夹）
   - 复制显示的扩展 ID

## 使用方法

1. 点击扩展图标
2. 点击 "连接到 Notion"
3. 在弹出的 Notion 授权页面中选择工作区并授权
4. 选择要保存的目标页面
5. 点击 "保存到 Notion"

## 支持的功能

- 保存普通网页内容
- 保存 Twitter 线
- 自动提取页面标题和链接 