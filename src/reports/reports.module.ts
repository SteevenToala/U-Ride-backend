import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './report.entity';
import { User } from 'src/users/user.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AuditLogsModule } from 'src/audit_logs/audit_logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Report, User]), AuditLogsModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
