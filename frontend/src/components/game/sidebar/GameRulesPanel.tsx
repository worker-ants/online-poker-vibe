'use client';

import { useState } from 'react';
import type { PokerVariant, GameMode, RoomSettings } from '@/src/lib/types';
import { VARIANT_LABELS, MODE_LABELS } from '@/src/lib/constants';

interface GameRulesPanelProps {
  variant: PokerVariant;
  mode: GameMode;
  settings: RoomSettings;
}

const numberFormat = new Intl.NumberFormat('en-US');

function formatNumber(n: number): string {
  return numberFormat.format(n);
}

export default function GameRulesPanel({ variant, mode, settings }: GameRulesPanelProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const showAnte = variant === 'seven-card-stud' && settings.ante != null && settings.ante > 0;
  const showSchedule = mode === 'tournament' && (settings.blindSchedule?.length ?? 0) > 0;

  return (
    <div className="rounded-lg bg-gray-800 p-3">
      <h3 className="mb-2 font-bold text-white">게임 룰</h3>

      <div className="flex flex-col gap-1.5 text-sm">
        <Row label="게임 종류" value={VARIANT_LABELS[variant]} />
        <Row label="게임 모드" value={MODE_LABELS[mode]} />
        <Row label="Blinds" value={`${formatNumber(settings.smallBlind)} / ${formatNumber(settings.bigBlind)}`} />
        <Row label="시작 칩" value={formatNumber(settings.startingChips)} />
        {showAnte && <Row label="Ante" value={formatNumber(settings.ante ?? 0)} />}
      </div>

      {showSchedule && (
        <div className="mt-2 border-t border-gray-700 pt-2">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium text-gray-300 hover:text-white"
            onClick={() => setScheduleOpen((prev) => !prev)}
          >
            <span>Blind Schedule</span>
            <span className="text-xs">{scheduleOpen ? '▲' : '▼'}</span>
          </button>

          {scheduleOpen && (
            <div className="mt-1.5 flex flex-col gap-1">
              {settings.blindSchedule?.map((level) => (
                <div
                  key={level.level}
                  className="flex items-center justify-between text-xs text-gray-400"
                >
                  <span>Lv.{level.level}</span>
                  <span>
                    {formatNumber(level.smallBlind)} / {formatNumber(level.bigBlind)}
                  </span>
                  <span>{level.handsPerLevel}핸드</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
