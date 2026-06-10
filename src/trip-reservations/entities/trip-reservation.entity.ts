import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';
import { SharedTrip } from '../../shared-trips/entities/shared-trip.entity';

@Entity({ name: 'trip_reservations' })
export class TripReservation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  id_trip: number;

  @ManyToOne(() => SharedTrip)
  @JoinColumn({ name: 'id_trip' })
  trip: SharedTrip;

  @Column()
  id_passenger: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'id_passenger' })
  passenger: User;

  @Column({ name: 'seats_requested', default: 1 })
  seats_requested: number;

  @Column({ default: 'PENDING' }) // PENDING, ACCEPTED, REJECTED, CANCELLED
  status: string;

  @Column({ nullable: true })
  message: string;

  @Column({ name: 'payment_method', default: 'EFECTIVO' }) // EFECTIVO, PAYPAL
  payment_method: string;

  @Column({ name: 'payment_status', default: 'PENDIENTE' }) // PENDIENTE, PAGADO
  payment_status: string;

  @Column({ name: 'paypal_order_id', nullable: true })
  paypal_order_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
