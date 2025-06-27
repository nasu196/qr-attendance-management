"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Gemini APIでチャット応答を生成
export const generateChatResponse = action({
  args: {
    message: v.string(),
    conversationHistory: v.optional(v.array(v.object({
      role: v.string(),
      content: v.string(),
    }))),
  },
  returns: v.object({
    success: v.boolean(),
    response: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("Google AI API キーが設定されていません");
    }

    try {
      // Gemini API URL (gemini-2.5-flash-lite-preview-06-17)
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${apiKey}`;

      // ヘルプデータを取得（エラー時は基本情報のみ使用）
      let helpData: string = "";
      try {
        helpData = await ctx.runQuery(internal.help.getHelpForAI, {});
      } catch (error) {
        console.log("ヘルプデータの取得に失敗しました:", error);
        helpData = "基本的なQR勤怠管理システムの機能についてサポートします。";
      }

      const systemPrompt: string = `あなたはQR勤怠管理システムの専門アシスタントです。

以下のヘルプ情報を参考に、ユーザーの質問に分かりやすく日本語で回答してください：

${helpData}

このシステムは以下の機能を提供しています：
- QRコードによる出勤・退勤打刻
- スタッフ管理（追加・編集・状態管理）
- 勤怠データの集計・レポート
- 月次カレンダー表示
- 勤務パターン設定

**回答時の注意点：**
1. 具体的で実用的なアドバイスを提供する
2. 手順は番号付きリストで明確に説明する
3. 重要な注意点は強調して伝える
4. 技術的な詳細よりも実際の操作方法に焦点を当てる
5. 必要に応じて関連機能も案内する

ユーザーが困っている場合は、段階的に解決策を提示し、サポートしてください。`;

      const messages: any[] = [];
      
      // システムプロンプトを追加
      messages.push({
        role: "user",
        parts: [{ text: systemPrompt }]
      });
      
      // 会話履歴を追加
      if (args.conversationHistory && args.conversationHistory.length > 0) {
        args.conversationHistory.forEach(msg => {
          messages.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }]
          });
        });
      }
      
      // 現在のメッセージを追加
      messages.push({
        role: "user",
        parts: [{ text: args.message }]
      });

      const requestBody: any = {
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      const response: Response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API Error:", errorText);
        throw new Error(`Gemini API エラー: ${response.status}`);
      }

      const data: any = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("Gemini APIから応答が得られませんでした");
      }

      const aiResponse: string = data.candidates[0].content.parts[0].text;
      
      return {
        success: true,
        response: aiResponse,
      };

    } catch (error) {
      console.error("AI Chat Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "不明なエラーが発生しました",
      };
    }
  },
}); 