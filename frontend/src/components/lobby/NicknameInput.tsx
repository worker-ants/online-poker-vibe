'use client';

import { useState } from 'react';
import { useIdentity } from '@/src/providers/IdentityProvider';
import { useToast } from '@/src/providers/ToastProvider';
import Button from '@/src/components/shared/Button';

export default function NicknameInput() {
  const { nickname, setNickname } = useIdentity();
  const { addToast } = useToast();
  const [input, setInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    const result = await setNickname(trimmed);
    setIsSubmitting(false);

    if (result.success) {
      setIsEditing(false);
      addToast('닉네임이 설정되었습니다.', 'success');
    } else {
      addToast(result.error ?? '닉네임 설정에 실패했습니다.', 'error');
    }
  };

  if (nickname && !isEditing) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-lg text-white">
          닉네임: <strong>{nickname}</strong>
        </span>
        <button
          onClick={() => {
            setInput(nickname);
            setIsEditing(true);
          }}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          변경
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder="닉네임을 입력하세요"
        maxLength={20}
        className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
      />
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || !input.trim()}
        size="sm"
      >
        {isSubmitting ? '...' : nickname ? '변경' : '설정'}
      </Button>
      {isEditing && (
        <button
          onClick={() => setIsEditing(false)}
          className="text-sm text-gray-400 hover:text-gray-300"
        >
          취소
        </button>
      )}
    </div>
  );
}
