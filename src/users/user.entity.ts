import { Entity, PrimaryGeneratedColumn, Column, BeforeInsert, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { hash } from 'bcrypt';
import { Rol } from 'src/roles/rol.entity';
import { DriversPosition } from 'src/drivers_position/drivers_position.entity';
import { ClientRequests } from 'src/client_requests/client_requests.entity';
import { DriverTripOffers } from 'src/driver_trip_offers/driver_trip_offers.entity';
import { DriverCarInfo } from 'src/driver_car_info/driver_car_info.entity';


@Entity({ name: 'users' })
export class User {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;
    
    @Column()
    lastname: string;

    @Column({ nullable: true })
    career: string;

    @Column({ nullable: true })
    reference_zone: string;

    @Column({ unique: true })
    email: string;
    
    @Column({ unique: true, nullable: true })
    phone: string;
    
    @Column({ nullable: true })
    image: string;
    
    @Column()
    password: string;
    
    @Column({ nullable: true })
    notification_token: string;

    @Column({ default: false })
    institutional_verified: boolean;

    @Column({ nullable: true })
    email_verification_code: string;

    @Column('decimal', { precision: 3, scale: 2, default: 0 })
    reputation_average: number;

    @Column({ default: 0 })
    reputation_count: number;

    @Column({ default: true })
    is_approved: boolean;

    @Column({ default: false })
    is_driver_approved: boolean;

    @Column({ default: false })
    is_suspended: boolean;

    @Column({ type: 'datetime', nullable: true })
    suspended_until: Date;

    @Column({ nullable: true })
    reset_password_code: string;

    @Column({ type: 'datetime', nullable: true })
    reset_password_expires: Date;
    
    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
    
    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    updated_at: Date;

    @JoinTable({
        name: 'user_has_roles',
        joinColumn: {
            name: 'id_user'
        },
        inverseJoinColumn: {
            name: 'id_rol'
        }
    })
    @ManyToMany(() => Rol, (rol) => rol.users)
    roles: Rol[];

    @OneToMany(() => DriversPosition, driversPosition => driversPosition.id_driver)
    driversPosition: DriversPosition;

    @OneToMany(() => ClientRequests, clientRequests => clientRequests.driver)
    publishedTrips: ClientRequests;

    @OneToMany(() => DriverTripOffers, driverTripOffers => driverTripOffers.passenger)
    tripJoinRequests: DriverTripOffers;

    @OneToMany(() => DriverCarInfo, driverCarInfo => driverCarInfo.id_driver)
    driverCarInfo: DriverCarInfo;
    
   
    @BeforeInsert()
    async hashPassword() {
        this.password = await hash(this.password, Number(process.env.HASH_SALT));
    }

}