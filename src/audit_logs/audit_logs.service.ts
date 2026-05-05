import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit_log.entity';

@Injectable()
export class AuditLogsService {
  constructor(@InjectRepository(AuditLog) private logsRepository: Repository<AuditLog>) {}

  log(actor_user_id: number, event_type: string, details?: string) {
    const event = this.logsRepository.create({
      actor_user_id,
      event_type,
      details,
    });
    return this.logsRepository.save(event);
  }

  findAll() {
    return this.logsRepository.find({
      order: { created_at: 'DESC' },
    });
  }
}
