'use client';

import { useState } from 'react';
import Modal from '@/src/components/shared/Modal';
import Button from '@/src/components/shared/Button';
import type { PokerVariant, GameMode } from '@/src/lib/types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    variant: PokerVariant;
    mode: GameMode;
    maxPlayers: number;
    settings: {
      startingChips: number;
      smallBlind: number;
      bigBlind: number;
    };
  }) => void;
}

export default function CreateRoomModal({ isOpen, onClose, onCreate }: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [variant, setVariant] = useState<PokerVariant>('texas-holdem');
  const [mode, setMode] = useState<GameMode>('tournament');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [startingChips, setStartingChips] = useState(1000);
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      variant,
      mode,
      maxPlayers,
      settings: { startingChips, smallBlind, bigBlind },
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Room 만들기">
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm text-gray-300">방 이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="방 이름을 입력하세요"
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-300">포커 변형</label>
          <div className="flex gap-2">
            {([
              ['texas-holdem', "Texas Hold'em"],
              ['five-card-draw', '5 Card Draw'],
              ['seven-card-stud', '7 Card Stud'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setVariant(value)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  variant === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-300">게임 모드</label>
          <div className="flex gap-2">
            {([
              ['tournament', 'Tournament'],
              ['cash', 'Cash Game'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  mode === value
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-gray-300">최대 인원</label>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}명</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">시작 칩</label>
            <input
              type="number"
              value={startingChips}
              onChange={(e) => setStartingChips(Number(e.target.value))}
              min={100}
              step={100}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">Small Blind</label>
            <input
              type="number"
              value={smallBlind}
              onChange={(e) => setSmallBlind(Number(e.target.value))}
              min={1}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">Big Blind</label>
            <input
              type="number"
              value={bigBlind}
              onChange={(e) => setBigBlind(Number(e.target.value))}
              min={2}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            만들기
          </Button>
        </div>
      </div>
    </Modal>
  );
}
