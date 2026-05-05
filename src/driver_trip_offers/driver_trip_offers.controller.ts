import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { DriverTripOffersService } from './driver_trip_offers.service';
import { CreateDriverTripOffersDto } from './dto/create_driver_trip_offers.dto';

@Controller('join-requests')
export class DriverTripOffersController {
  constructor(private driverTripOffersService: DriverTripOffersService) {}

  @Get('trip/:id_trip')
  findByClientRequest(@Param('id_trip', ParseIntPipe) id_trip: number) {
    return this.driverTripOffersService.findByClientRequest(id_trip);
  }

  @Get('passenger/:id_passenger')
  findByPassenger(@Param('id_passenger', ParseIntPipe) id_passenger: number) {
    return this.driverTripOffersService.findByPassenger(id_passenger);
  }

  @Post()
  create(@Body() driverTripOffer: CreateDriverTripOffersDto) {
    return this.driverTripOffersService.create(driverTripOffer);
  }
}
