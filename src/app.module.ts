import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { SocketModule } from './socket/socket.module';
import { DriversPositionModule } from './drivers_position/drivers_position.module';
import { ClientRequestsModule } from './client_requests/client_requests.module';
import { TimeAndDistanceValuesModule } from './time_and_distance_values/time_and_distance_values.module';
import { DriverTripOffersModule } from './driver_trip_offers/driver_trip_offers.module';
import { DriverCarInfoModule } from './driver_car_info/driver_car_info.module';
import { ReportsModule } from './reports/reports.module';
import { AuditLogsModule } from './audit_logs/audit_logs.module';
import { SeedModule } from './seed/seed.module';
import { FirebaseModule } from './firebase/firebase.module';
import { SharedTripsModule } from './shared-trips/shared-trips.module';
import { TripReservationsModule } from './trip-reservations/trip-reservations.module';

@Module({
  imports: [
    // Configuración global - lee variables de entorno
    ConfigModule.forRoot({ isGlobal: true, cache: true }),

    // TypeORM - configuración desde variables de entorno
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USER', 'root'),
        password: config.get<string>('DB_PASS', 'password'),
        database: config.get<string>('DB_NAME', 'uride_db'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
        charset: 'utf8mb4',
        timezone: 'local',
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),

    // Módulos de negocio U-Ride
    UsersModule,
    AuthModule,
    RolesModule,
    SocketModule,
    DriversPositionModule,
    ClientRequestsModule,
    TimeAndDistanceValuesModule,
    DriverTripOffersModule,
    DriverCarInfoModule,
    ReportsModule,
    AuditLogsModule,

    // Seed inicial: crea roles y admin si no existen
    SeedModule,
    
    // Firebase para notificaciones / autenticación extra
    FirebaseModule,

    // Módulos nuevos U-Ride
    SharedTripsModule,
    TripReservationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
