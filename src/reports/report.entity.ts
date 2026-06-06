import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from 'src/users/user.entity';

export enum ReportStatus {
  OPEN = 'OPEN',
  REVIEWED = 'REVIEWED',
  WARNED = 'WARNED',
  ACTION_APPLIED = 'ACTION_APPLIED',
  DISMISSED = 'DISMISSED',
}

@Entity({ name: 'reports' })
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  reporter_user_id: number;

  @Column()
  reported_user_id: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  evidence_url: string;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.OPEN,
  })
  status: ReportStatus;

  @Column({ type: 'text', nullable: true })
  admin_notes: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'reporter_user_id' })
  reporter: User;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'reported_user_id' })
  reported: User;
}
