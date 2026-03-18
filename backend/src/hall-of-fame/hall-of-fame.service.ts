import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GameParticipant } from '../game/game-participant.entity.js';
import { Game } from '../game/game.entity.js';
import { Player } from '../player/player.entity.js';
import { AI_UUID_PREFIX } from '../ai/ai-names.js';

export interface RankingEntry {
  rank: number;
  uuid: string;
  nickname: string;
  wins: number;
  draws: number;
  losses: number;
  abandonments: number;
  winRate: number;
  totalGames: number;
  lastGameTime: string | null;
}

export interface GameHistoryEntry {
  gameId: string;
  variant: string;
  mode: string;
  gameTime: string;
  result: string;
  players: { nickname: string; placement: number | null }[];
}

@Injectable()
export class HallOfFameService {
  constructor(
    @InjectRepository(GameParticipant)
    private readonly participantRepository: Repository<GameParticipant>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
  ) {}

  async getRankings(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: RankingEntry[];
    pagination: { page: number; limit: number; total: number };
  }> {
    // Use raw query for the aggregation
    const countResult: { count?: string } | undefined =
      await this.participantRepository
        .createQueryBuilder('gp')
        .select('COUNT(DISTINCT gp.playerUuid)', 'count')
        .innerJoin('gp.game', 'g')
        .where('g.status IN (:...statuses)', {
          statuses: ['completed', 'abandoned'],
        })
        .andWhere('gp.playerUuid NOT LIKE :aiPrefix', {
          aiPrefix: `${AI_UUID_PREFIX}%`,
        })
        .getRawOne();

    const total = parseInt(countResult?.count ?? '0', 10);
    const offset = (page - 1) * limit;

    interface RawRankingRow {
      uuid: string;
      nickname: string | null;
      totalGames: string;
      wins: string;
      draws: string;
      losses: string;
      abandonments: string;
      winRate: string | null;
      lastGameTime: string | null;
    }

    const results: RawRankingRow[] = await this.participantRepository
      .createQueryBuilder('gp')
      .select('gp.playerUuid', 'uuid')
      .addSelect('p.nickname', 'nickname')
      .addSelect('COUNT(*)', 'totalGames')
      .addSelect("SUM(CASE WHEN gp.result = 'win' THEN 1 ELSE 0 END)", 'wins')
      .addSelect("SUM(CASE WHEN gp.result = 'draw' THEN 1 ELSE 0 END)", 'draws')
      .addSelect(
        "SUM(CASE WHEN gp.result = 'loss' THEN 1 ELSE 0 END)",
        'losses',
      )
      .addSelect(
        "SUM(CASE WHEN gp.result = 'abandoned' THEN 1 ELSE 0 END)",
        'abandonments',
      )
      .addSelect(
        "ROUND(CAST(SUM(CASE WHEN gp.result = 'win' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2)",
        'winRate',
      )
      .addSelect('MAX(g.finishedAt)', 'lastGameTime')
      .innerJoin('gp.player', 'p')
      .innerJoin('gp.game', 'g')
      .where('g.status IN (:...statuses)', {
        statuses: ['completed', 'abandoned'],
      })
      .andWhere('gp.playerUuid NOT LIKE :aiPrefix', {
        aiPrefix: `${AI_UUID_PREFIX}%`,
      })
      .groupBy('gp.playerUuid')
      .orderBy('winRate', 'DESC')
      .addOrderBy('wins', 'DESC')
      .addOrderBy('totalGames', 'DESC')
      .addOrderBy('lastGameTime', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany();

    const data: RankingEntry[] = results.map((r: RawRankingRow, i: number) => ({
      rank: offset + i + 1,
      uuid: r.uuid,
      nickname: r.nickname ?? 'Unknown',
      wins: parseInt(r.wins, 10),
      draws: parseInt(r.draws, 10),
      losses: parseInt(r.losses, 10),
      abandonments: parseInt(r.abandonments, 10),
      winRate: parseFloat(r.winRate ?? '0'),
      totalGames: parseInt(r.totalGames, 10),
      lastGameTime: r.lastGameTime,
    }));

    return {
      data,
      pagination: { page, limit, total },
    };
  }

  async getPlayerHistory(playerUuid: string): Promise<{
    nickname: string;
    games: GameHistoryEntry[];
  }> {
    const player = await this.playerRepository.findOne({
      where: { uuid: playerUuid },
    });

    if (!player) {
      return { nickname: 'Unknown', games: [] };
    }

    const participations = await this.participantRepository.find({
      where: { playerUuid },
      relations: ['game'],
      order: { game: { finishedAt: 'DESC' } },
    });

    // Batch query all participants for all games to avoid N+1
    const validParticipations = participations.filter(
      (p) => p.game && p.game.status !== 'in-progress',
    );
    const gameIds = validParticipations.map((p) => p.game?.id).filter(Boolean);

    const allParticipants =
      gameIds.length > 0
        ? await this.participantRepository.find({
            where: { gameId: In(gameIds) },
            relations: ['player'],
            order: { placement: 'ASC' },
          })
        : [];

    // Group by gameId
    const participantsByGame = new Map<string, typeof allParticipants>();
    for (const p of allParticipants) {
      const arr = participantsByGame.get(p.gameId) ?? [];
      arr.push(p);
      participantsByGame.set(p.gameId, arr);
    }

    const games: GameHistoryEntry[] = [];

    for (const participation of validParticipations) {
      const game = participation.game;
      const gameParticipants = participantsByGame.get(game.id) ?? [];

      games.push({
        gameId: game.id,
        variant: game.variant,
        mode: game.mode,
        gameTime:
          game.finishedAt?.toISOString() ?? game.startedAt.toISOString(),
        result: participation.result,
        players: gameParticipants.map((ap) => ({
          nickname: ap.player?.nickname ?? 'Unknown',
          placement: ap.placement,
        })),
      });
    }

    return {
      nickname: player.nickname ?? 'Unknown',
      games,
    };
  }
}
