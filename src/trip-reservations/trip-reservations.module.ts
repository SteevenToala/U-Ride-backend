import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripReservation } from './entities/trip-reservation.entity';
import { TripReservationsService } from './trip-reservations.service';
import { TripReservationsController } from './trip-reservations.controller';
import { PaypalService } from './paypal.service';
import { SharedTrip } from '../shared-trips/entities/shared-trip.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TripReservation, SharedTrip])],
  controllers: [TripReservationsController],
  providers: [TripReservationsService, PaypalService],
  exports: [TripReservationsService],
})
export class TripReservationsModule {}
