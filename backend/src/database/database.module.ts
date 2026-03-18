import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: join(__dirname, '..', '..', 'data', 'poker.sqlite'),
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      prepareDatabase: (db: { pragma: (sql: string) => void }) => {
        db.pragma('foreign_keys = ON');
      },
    }),
  ],
})
export class DatabaseModule {}
