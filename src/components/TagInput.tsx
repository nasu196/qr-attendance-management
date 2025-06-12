import { useState } from "react";

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
}

export function TagInput({ tags, onTagsChange, availableTags }: TagInputProps) {
  const [newTag, setNewTag] = useState("");

  const handleAddTag = (tag?: string) => {
    const tagToAdd = tag || newTag.trim();
    if (tagToAdd && !tags.includes(tagToAdd)) {
      onTagsChange([...tags, tagToAdd]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const unusedTags = availableTags.filter(tag => !tags.includes(tag));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        所属タグ
      </label>
      <p className="text-xs text-gray-500 mb-2">
        部署（特養、デイサービス等）や役職（介護職員、看護師等）、その他の属性（3階、夜勤可等）をタグで管理します
      </p>
      
      {/* 新規タグ入力 */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="新しいタグを入力"
        />
        <button
          type="button"
          onClick={() => handleAddTag()}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          追加
        </button>
      </div>
      
      {/* 選択済みタグ表示 */}
      {tags.length > 0 && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            選択中: {tags.length}個のタグ
          </label>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 既存タグから選択 */}
      {unusedTags.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            既存タグから選択
          </label>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {unusedTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddTag(tag)}
                className="inline-flex items-center bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
