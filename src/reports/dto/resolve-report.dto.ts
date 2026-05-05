import { ReportStatus } from '../report.entity';

export class ResolveReportDto {
  admin_user_id: number;
  status: ReportStatus;
  admin_notes?: string;
  suspend_user_until?: Date;
}
