import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedTripsService } from './shared-trips.service';
import { SharedTripsController } from './shared-trips.controller';
import { SharedTrip } from './entities/shared-trip.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SharedTrip])],
  controllers: [SharedTripsController],
  providers: [SharedTripsService],
})
export class SharedTripsModule {}
