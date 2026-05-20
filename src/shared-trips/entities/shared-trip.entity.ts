import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';

@Entity({ name: 'shared_trips' })
export class SharedTrip {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  id_driver: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'id_driver' })
  driver: User;

  @Column({ name: 'origin_zone' })
  origin_zone: string;

  @Column({ name: 'origin_lat', type: 'decimal', precision: 10, scale: 6, default: 0 })
  origin_lat: number;

  @Column({ name: 'origin_lng', type: 'decimal', precision: 10, scale: 6, default: 0 })
  origin_lng: number;

  @Column({ name: 'destination_zone' })
  destination_zone: string;

  @Column({ name: 'destination_lat', type: 'decimal', precision: 10, scale: 6, default: 0 })
  destination_lat: number;

  @Column({ name: 'destination_lng', type: 'decimal', precision: 10, scale: 6, default: 0 })
  destination_lng: number;

  @Column({ name: 'departure_time', type: 'datetime' })
  departure_time: Date;

  @Column({ name: 'total_seats' })
  total_seats: number;

  @Column({ name: 'available_seats' })
  available_seats: number;

  @Column({ name: 'fare_per_seat', type: 'decimal', precision: 10, scale: 2 })
  fare_per_seat: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ default: 'SCHEDULED' }) // SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
