import { useState } from "react";
import { marked } from "marked";

interface AIChatProps {
  isPremium: boolean;
}

export function AIChat({ isPremium }: AIChatProps) {
  const [messages, setMessages] = useState<Array<{ id: string; text: string; isUser: boolean; timestamp: Date }>>([
    {
      id: "welcome",
      text: "こんにちは！勤怠管理システムのAIアシスタントです。現在Supabase移行作業中のため、一時的に機能が制限されています。移行完了後に全機能をご利用いただけます。",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // マークダウンをHTMLに変換する関数
  const parseMarkdown = (text: string) => {
    try {
      const result = marked.parse(text, {
        breaks: true, // 改行を<br>に変換
        gfm: true,    // GitHub Flavored Markdown
      });
      return typeof result === 'string' ? result : '';
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return text; // エラー時は元のテキストを返す
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      text: inputText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText;
    setInputText("");
    setIsLoading(true);

    try {
      // TODO: Supabase移行後に実装
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模擬遅延
      
      const aiResponse = {
        id: `ai-${Date.now()}`,
        text: `申し訳ございませんが、現在システム移行作業中のため、AIアシスタント機能は一時的に利用できません。\n\n「${messageText}」についてのご質問は、移行完了後にお答えいたします。\n\n**実装予定機能:**\n- スタッフ管理サポート\n- 勤怠記録の説明\n- システム操作ガイド\n- トラブルシューティング`,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      const errorResponse = {
        id: `error-${Date.now()}`,
        text: `申し訳ございません。エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* ヘッダー */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="font-semibold text-gray-900">AIアシスタント</h3>
            <p className="text-xs text-gray-600">勤怠管理をサポート</p>
          </div>
          <div className="ml-auto">
            <div className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full text-xs font-medium">
              移行作業中
            </div>
          </div>
        </div>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                message.isUser
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              <div className="text-sm">
                {message.isUser ? (
                  // ユーザーメッセージはそのまま表示
                  <p>{message.text}</p>
                ) : (
                  // AIメッセージはマークダウンとしてレンダリング
                  <div
                    className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-strong:font-bold prose-code:text-gray-800 prose-code:bg-gray-200 prose-code:px-1 prose-code:rounded prose-headings:text-gray-900 prose-headings:font-semibold"
                    dangerouslySetInnerHTML={{
                      __html: parseMarkdown(message.text)
                    }}
                  />
                )}
              </div>
              <p className={`text-xs mt-1 ${
                message.isUser ? "text-blue-100" : "text-gray-500"
              }`}>
                {message.timestamp.toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 入力エリア */}
      <div className="flex-shrink-0 border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="メッセージを入力してください（移行作業中）..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={() => void handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            送信
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Enter: 送信 | Shift+Enter: 改行 | ※移行作業中につき機能制限中
        </p>
      </div>
    </div>
  );
} 