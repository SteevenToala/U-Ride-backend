import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { SharedTripsService } from './shared-trips.service';

@Controller('shared-trips')
export class SharedTripsController {
  constructor(private readonly sharedTripsService: SharedTripsService) {}

  @Post()
  create(@Body() createSharedTripDto: any) {
    return this.sharedTripsService.create(createSharedTripDto);
  }

  @Get()
  findAll() {
    return this.sharedTripsService.findAll();
  }

  @Get('driver/:id')
  findByDriver(@Param('id') id: string) {
    return this.sharedTripsService.findByDriver(+id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sharedTripsService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateSharedTripDto: any) {
    return this.sharedTripsService.update(+id, updateSharedTripDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sharedTripsService.remove(+id);
  }

  @Put(':id/start')
  startTrip(@Param('id') id: string) {
    return this.sharedTripsService.update(+id, { status: 'ACTIVE' });
  }

  @Put(':id/finish')
  finishTrip(@Param('id') id: string) {
    return this.sharedTripsService.update(+id, { status: 'FINISHED' });
  }

  @Put(':id/cancel')
  cancelTrip(@Param('id') id: string) {
    return this.sharedTripsService.update(+id, { status: 'CANCELLED' });
  }
}
