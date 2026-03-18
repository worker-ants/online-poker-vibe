import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './player.entity.js';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
  ) {}

  async findByUuid(uuid: string): Promise<Player | null> {
    return this.playerRepository.findOne({ where: { uuid } });
  }

  async findOrCreate(uuid: string): Promise<Player> {
    let player = await this.findByUuid(uuid);
    if (!player) {
      player = this.playerRepository.create({ uuid, nickname: null });
      try {
        await this.playerRepository.save(player);
      } catch (error: unknown) {
        const err = error as { code?: string; name?: string };
        if (
          err.code === 'SQLITE_CONSTRAINT' ||
          err.name === 'QueryFailedError'
        ) {
          player = await this.findByUuid(uuid);
          if (!player) throw error;
        } else {
          throw error;
        }
      }
    }
    return player;
  }

  async setNickname(uuid: string, nickname: string): Promise<Player> {
    const trimmed = nickname.trim();

    if (trimmed.length < 2 || trimmed.length > 20) {
      throw new BadRequestException('닉네임은 2~20자여야 합니다.');
    }

    if (!/^[a-zA-Z가-힣0-9_]+$/.test(trimmed)) {
      throw new BadRequestException(
        '닉네임은 영문, 한글, 숫자, 언더스코어만 허용됩니다.',
      );
    }

    const existing = await this.playerRepository.findOne({
      where: { nickname: trimmed },
    });
    if (existing && existing.uuid !== uuid) {
      throw new BadRequestException('이미 사용 중인 닉네임입니다.');
    }

    const player = await this.findOrCreate(uuid);
    player.nickname = trimmed;
    try {
      return await this.playerRepository.save(player);
    } catch (error: unknown) {
      const err = error as { code?: string; name?: string };
      if (err.code === 'SQLITE_CONSTRAINT' || err.name === 'QueryFailedError') {
        throw new BadRequestException('이미 사용 중인 닉네임입니다.');
      }
      throw error;
    }
  }

  async isNicknameSet(uuid: string): Promise<boolean> {
    const player = await this.findByUuid(uuid);
    return player !== null && player.nickname !== null;
  }
}
