import { DriverTripOffers } from "src/driver_trip_offers/driver_trip_offers.entity";
import { User } from "src/users/user.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";

export enum Status {
    PUBLISHED = 'PUBLISHED',
    IN_PROGRESS = 'IN_PROGRESS',
    FINISHED = 'FINISHED',
    CANCELLED = 'CANCELLED'
}

@Entity({name: 'client_requests'})
export class ClientRequests {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    id_driver: number;

    @Column()
    origin_zone: string;

    @Column()
    destination_zone: string;

    @Column({ type: 'datetime' })
    departure_time: Date;

    @Column({ default: 1 })
    seats_total: number;

    @Column({ default: 1 })
    seats_available: number;

    @Column({ type: 'text', nullable: true })
    notes_rules: string;

    @Column({ default: true })
    security_rules_visible: boolean;

    @Column({ default: 0 })
    confirmed_passengers: number;

    @Column({
        type: 'enum',
        enum: Status,
        default: Status.PUBLISHED
    })
    status: Status

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
    
    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    updated_at: Date;

    @ManyToOne(() => User, (user) => user.id)
    @JoinColumn({ name: 'id_driver' })
    driver: User;

    @OneToMany(() => DriverTripOffers, driverTripOffers => driverTripOffers.trip, {
        cascade: true
    })
    driverTripOffers: DriverTripOffers;

}