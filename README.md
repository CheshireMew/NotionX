# NotionX

一个将网页内容保存到 Notion 的 Chrome 扩展。

## 设置步骤

1. 访问 [Notion Developers](https://www.notion.so/my-integrations) 创建新的集成
   - 点击 "New integration"
   - Name: NotionX
   - Associated workspace: 选择您的工作区
   - Type: Internal integration
   - Capabilities: 确保启用以下权限：
     - Read content
     - Update content
     - Insert content

2. 在集成设置页面：
   - 复制 `Internal Integration Token`

3. 在您想要保存内容的 Notion 页面中：
   - 点击右上角的 Share 按钮
   - 点击 "Invite"
   - 在弹出的列表中找到并选择 "NotionX"

## 使用方法

1. 点击扩展图标
2. 按照提示输入 Integration Token
3. 选择要保存的目标页面（需要先在页面中添加集成权限）
4. 选择要保存的目标页面
5. 点击 "保存到 Notion"

## 支持的功能

- 保存普通网页内容
- 保存 Twitter 线
- 自动提取页面标题和链接 