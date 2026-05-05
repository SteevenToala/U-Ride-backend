export class CreateReportDto {
  reporter_user_id: number;
  reported_user_id: number;
  reason: string;
  evidence_url?: string;
}
