'use client';

interface PotDisplayProps {
  pot: number;
  sidePots?: { amount: number; playerUuids: string[] }[];
}

export default function PotDisplay({ pot, sidePots }: PotDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="rounded-lg bg-gray-900/80 px-4 py-2 text-center">
        <span className="text-sm text-gray-400">Pot</span>
        <div className="text-xl font-bold text-yellow-400">{pot}</div>
      </div>
      {sidePots && sidePots.length >= 1 && (
        <div className="flex gap-2 text-xs">
          {sidePots.map((sp, i) => (
            <span key={i} className="text-gray-400">
              Side {i + 1}: {sp.amount}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
