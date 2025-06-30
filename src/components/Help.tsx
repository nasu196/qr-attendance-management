import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { marked } from 'marked';

interface HelpProps {
  isPremium: boolean;
}

interface HelpSection {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
}

const Help = ({ isPremium }: HelpProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // TODO: Supabaseクエリでヘルプデータを取得
  const allHelpSections = [
    {
      id: '1',
      title: '基本的な使い方',
      content: 'システムの基本的な使い方について説明します。',
      category: 'basic',
      keywords: ['基本', '使い方', '操作']
    },
    {
      id: '2', 
      title: 'QRコードの使用方法',
      content: 'QRコードを使った勤怠管理の方法を説明します。',
      category: 'qr',
      keywords: ['QR', 'コード', '勤怠']
    }
  ];
  const searchResults = searchQuery.trim() ? 
    allHelpSections.filter(section => 
      section.title.includes(searchQuery) || 
      section.content.includes(searchQuery) ||
      section.keywords.some(keyword => keyword.includes(searchQuery))
    ) : null;

  const categories = [
    { id: 'all', name: '全て', icon: '📚' },
    { id: 'basic', name: '基本操作', icon: '📖' },
    { id: 'staff', name: 'スタッフ管理', icon: '👥' },
    { id: 'qr', name: 'QRコード', icon: '📱' },
    { id: 'attendance', name: '勤怠管理', icon: '⏰' },
    { id: 'settings', name: '設定', icon: '⚙️' }
  ];

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const parseMarkdown = (content: string): string => {
    return marked.parse(content) as string;
  };

  if (!allHelpSections) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg">ヘルプデータを読み込み中...</div>
        </div>
      </div>
    );
  }

  const displaySections: HelpSection[] = searchQuery.trim() 
    ? (searchResults || [])
    : selectedCategory === 'all' 
      ? allHelpSections
      : allHelpSections.filter(section => section.category === selectedCategory);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">ヘルプ・マニュアル</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="キーワードで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>
      </div>

      {/* カテゴリナビゲーション */}
      <div className="flex flex-wrap gap-2 pb-4 border-b">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSelectedCategory(category.id);
              setSearchQuery('');
            }}
            className="flex items-center gap-2"
          >
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </Button>
        ))}
      </div>

      {/* 検索結果の表示 */}
      {searchQuery.trim() && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-700">
            「{searchQuery}」の検索結果: {displaySections.length}件
          </p>
        </div>
      )}

      {/* ヘルプセクション */}
      <div className="grid grid-cols-1 gap-6">
        {displaySections.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">
                {searchQuery.trim() 
                  ? 'マッチするヘルプ項目が見つかりませんでした。' 
                  : '該当するヘルプ項目がありません。'}
              </p>
            </CardContent>
          </Card>
        ) : (
          displaySections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            
            return (
              <Card key={section.id} className="overflow-hidden">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-3">
                      <span>
                        {categories.find(cat => cat.id === section.category)?.icon || '📄'}
                      </span>
                      {section.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {categories.find(cat => cat.id === section.category)?.name || section.category}
                      </Badge>
                      <span className={`text-gray-400 transition-transform duration-500 ${isExpanded ? 'rotate-90' : ''}`}>
                        ▶
                      </span>
                    </div>
                  </div>
                </CardHeader>
                
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <CardContent className="bg-gray-50">
                    <div 
                      className="prose prose-sm max-w-none text-gray-700"
                      dangerouslySetInnerHTML={{ 
                        __html: parseMarkdown(section.content) 
                      }}
                    />
                    
                    {section.keywords.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-gray-500 mb-2">関連キーワード:</p>
                        <div className="flex flex-wrap gap-1">
                          {section.keywords.map((keyword, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* AIアシスタント案内 */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-3">
            <span>🤖</span>
            AIアシスタント
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            より詳しいサポートが必要な場合は、AIアシスタントにお気軽にお尋ねください。
            自然な言葉で質問すると、システムの使い方を詳しく説明いたします。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
            <div>
              <strong>質問例：</strong>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li>「新しいスタッフを追加するには？」</li>
                <li>「QRコードが読み取れない時は？」</li>
                <li>「月次レポートの見方を教えて」</li>
              </ul>
            </div>
            <div>
              <strong>便利な機能：</strong>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li>24時間いつでも質問可能</li>
                <li>段階的な手順説明</li>
                <li>トラブル対応サポート</li>
              </ul>
            </div>
          </div>
          <div className="mt-4">
            <Button 
              variant="outline" 
              className="bg-white hover:bg-gray-50"
              onClick={() => {
                // AIチャットタブに切り替える処理（必要に応じて実装）
                console.log('AIチャットタブに切り替え');
              }}
            >
              AIアシスタントに質問する →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Help;
