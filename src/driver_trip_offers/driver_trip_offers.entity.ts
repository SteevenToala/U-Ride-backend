import { ClientRequests } from "src/client_requests/client_requests.entity";
import { User } from "src/users/user.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

export enum JoinRequestStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED',
    CONFIRMED = 'CONFIRMED',
    CANCELLED = 'CANCELLED',
}

@Entity({name: 'driver_trip_offers'})
export class DriverTripOffers {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    id_passenger: number;

    @Column()
    id_trip: number;

    @Column({
        type: 'enum',
        enum: JoinRequestStatus,
        default: JoinRequestStatus.PENDING,
    })
    status: JoinRequestStatus;

    @Column({ type: 'text', nullable: true })
    message: string;

    @Column('decimal', { nullable: true, precision: 3, scale: 2 })
    passenger_rating_to_driver: number;

    @Column('decimal', { nullable: true, precision: 3, scale: 2 })
    driver_rating_to_passenger: number;

    @Column({ type: 'text', nullable: true })
    passenger_review_to_driver: string;

    @Column({ type: 'text', nullable: true })
    driver_review_to_passenger: string;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
    
    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    updated_at: Date;
    
    @ManyToOne(() => User, (user) => user.id)
    @JoinColumn({ name: 'id_passenger' })
    passenger: User;

    @ManyToOne(() => ClientRequests, (clientRequests) => clientRequests.id, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    @JoinColumn({ name: 'id_trip' })
    trip: ClientRequests;

    

}