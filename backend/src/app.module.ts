import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HealthModule } from './health/health.module'
import { User } from './users/user.entity'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PG_HOST ?? 'localhost',
      port: Number(process.env.PG_PORT ?? 5432),
      database: process.env.PG_DATABASE ?? 'app',
      username: process.env.PG_USER ?? 'postgres',
      password: process.env.PG_PASSWORD ?? 'postgres',
      entities: [User],
      synchronize: false,
      retryAttempts: 100,
      retryDelay: 3000,
    }),
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}
