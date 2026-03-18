'use client';

import Modal from '@/src/components/shared/Modal';
import type { PokerVariant } from '@/src/lib/types';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: PokerVariant;
}

const HAND_RANKINGS = [
  { name: 'Royal Flush', desc: 'A-K-Q-J-10 같은 무늬' },
  { name: 'Straight Flush', desc: '연속 5장 같은 무늬' },
  { name: 'Four of a Kind', desc: '같은 숫자 4장' },
  { name: 'Full House', desc: 'Three of a Kind + Pair' },
  { name: 'Flush', desc: '같은 무늬 5장' },
  { name: 'Straight', desc: '연속 5장' },
  { name: 'Three of a Kind', desc: '같은 숫자 3장' },
  { name: 'Two Pair', desc: '2개의 페어' },
  { name: 'One Pair', desc: '1개의 페어' },
  { name: 'High Card', desc: '위 조합 없음' },
];

const VARIANT_RULES: Record<string, string[]> = {
  'texas-holdem': [
    '각 플레이어에게 2장의 비공개 카드(홀카드)가 배분됩니다.',
    '5장의 커뮤니티 카드가 3단계로 공개됩니다: Flop(3장), Turn(1장), River(1장).',
    '홀카드 2장 + 커뮤니티 카드 5장 중 최적의 5장으로 핸드를 구성합니다.',
    '각 단계마다 베팅 라운드가 진행됩니다.',
  ],
  'five-card-draw': [
    '각 플레이어에게 5장의 비공개 카드가 배분됩니다.',
    '첫 번째 베팅 라운드 후, 원하는 카드를 교환할 수 있습니다 (0~5장).',
    '교환 후 두 번째 베팅 라운드가 진행됩니다.',
    '보유한 5장으로 핸드를 구성합니다.',
  ],
  'seven-card-stud': [
    '각 플레이어에게 총 7장이 배분됩니다 (3장 비공개 + 4장 공개).',
    '3rd~7th Street까지 5단계에 걸쳐 카드가 배분됩니다.',
    '각 Street마다 베팅 라운드가 진행됩니다.',
    '7장 중 최적의 5장으로 핸드를 구성합니다.',
    'Ante를 사용하며, 가장 낮은 공개 카드의 플레이어가 Bring-in을 합니다.',
  ],
};

export default function HelpModal({ isOpen, onClose, variant }: HelpModalProps) {
  const rules = variant ? VARIANT_RULES[variant] : VARIANT_RULES['texas-holdem'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="게임 도움말">
      <div className="max-h-96 overflow-y-auto">
        {variant && (
          <div className="mb-4">
            <h3 className="mb-2 font-bold text-white">게임 규칙</h3>
            <ul className="list-inside list-disc space-y-1 text-gray-300">
              {rules?.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="mb-2 font-bold text-white">핸드 랭킹 (높은 순)</h3>
          <div className="space-y-1">
            {HAND_RANKINGS.map((hand, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-medium text-yellow-400">{i + 1}. {hand.name}</span>
                <span className="text-gray-400">{hand.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="mb-2 font-bold text-white">베팅 액션</h3>
          <div className="space-y-1 text-sm text-gray-300">
            <p><strong>Fold:</strong> 핸드 포기</p>
            <p><strong>Check:</strong> 베팅 없이 넘기기 (현재 베팅이 0일 때)</p>
            <p><strong>Call:</strong> 현재 베팅과 동일한 금액 베팅</p>
            <p><strong>Raise:</strong> 현재 베팅보다 높은 금액 베팅</p>
            <p><strong>All-in:</strong> 모든 칩 베팅</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
