import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from '../users/user.entity';
import { Rol } from '../roles/rol.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Rol])],
  providers: [SeedService],
})
export class SeedModule {}
