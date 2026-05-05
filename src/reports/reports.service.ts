import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportStatus } from './report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { User } from 'src/users/user.entity';
import { AuditLogsService } from 'src/audit_logs/audit_logs.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private reportsRepository: Repository<Report>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(data: CreateReportDto) {
    if (data.reporter_user_id === data.reported_user_id) {
      throw new HttpException('No puedes reportarte a ti mismo', HttpStatus.BAD_REQUEST);
    }

    const report = this.reportsRepository.create({
      ...data,
      status: ReportStatus.OPEN,
    });

    const created = await this.reportsRepository.save(report);
    await this.auditLogsService.log(data.reporter_user_id, 'REPORT_CREATED', `report:${created.id};reported:${data.reported_user_id}`);
    return created;
  }

  findAll() {
    return this.reportsRepository.find({
      relations: ['reporter', 'reported'],
      order: { created_at: 'DESC' },
    });
  }

  async resolve(id: number, data: ResolveReportDto) {
    const report = await this.reportsRepository.findOneBy({ id });
    if (!report) {
      throw new HttpException('Reporte no encontrado', HttpStatus.NOT_FOUND);
    }

    report.status = data.status;
    report.admin_notes = data.admin_notes;
    await this.reportsRepository.save(report);

    if (data.suspend_user_until) {
      const user = await this.usersRepository.findOneBy({ id: report.reported_user_id });
      if (user) {
        user.is_suspended = true;
        user.suspended_until = data.suspend_user_until;
        await this.usersRepository.save(user);
      }
    }

    await this.auditLogsService.log(data.admin_user_id, 'REPORT_RESOLVED', `report:${id};status:${data.status}`);
    return report;
  }
}
