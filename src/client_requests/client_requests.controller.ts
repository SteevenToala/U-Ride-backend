import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ClientRequestsService } from './client_requests.service';
import { CreateClientRequestDto } from './dto/create_client_request.dto';
import { UpdateDriverAssignedClientRequestDto } from './dto/update_driver_assigned_client_request.dto';
import { UpdateStatusClientRequestDto } from './dto/update_status_client_request.dto';

@Controller('trips')
export class ClientRequestsController {
  constructor(private clientRequestsService: ClientRequestsService) {}

  @Get('safety-rules')
  getSafetyRules() {
    return this.clientRequestsService.getSafetyRules();
  }

  @Get()
  searchTrips(
    @Query('origin_zone') origin_zone?: string,
    @Query('destination_zone') destination_zone?: string,
    @Query('date') date?: string,
    @Query('available_only') available_only?: string,
  ) {
    return this.clientRequestsService.searchTrips({
      origin_zone,
      destination_zone,
      date,
      available_only,
    });
  }

  @Get('id/:id_trip')
  getTripById(@Param('id_trip', ParseIntPipe) id_trip: number) {
    return this.clientRequestsService.getByClientRequest(id_trip);
  }

  @Get('driver/assigned/:id_driver')
  getByDriverAssigned(@Param('id_driver', ParseIntPipe) id_driver: number) {
    return this.clientRequestsService.getByDriverAssigned(id_driver);
  }

  @Get('passenger/assigned/:id_passenger')
  getByPassengerAssigned(@Param('id_passenger', ParseIntPipe) id_passenger: number) {
    return this.clientRequestsService.getByClientAssigned(id_passenger);
  }

  @Post()
  create(@Body() clientRequest: CreateClientRequestDto) {
    return this.clientRequestsService.create(clientRequest);
  }

  @Post(':id_trip/join-requests')
  requestJoin(
    @Param('id_trip', ParseIntPipe) id_trip: number,
    @Body() data: { id_passenger: number; message?: string },
  ) {
    return this.clientRequestsService.requestJoin(id_trip, data.id_passenger, data.message);
  }

  @Put(':id_trip/join-requests/decision')
  updateDriverAssigned(
    @Param('id_trip', ParseIntPipe) id_trip: number,
    @Body() data: UpdateDriverAssignedClientRequestDto & { id_driver: number },
  ) {
    return this.clientRequestsService.updateDriverAssigned(id_trip, data.id_driver, data);
  }

  @Put(':id_trip/join-requests/:id_join_request/confirm')
  confirmParticipation(
    @Param('id_trip', ParseIntPipe) id_trip: number,
    @Param('id_join_request', ParseIntPipe) id_join_request: number,
    @Body() data: { id_driver: number },
  ) {
    return this.clientRequestsService.confirmParticipation(id_trip, data.id_driver, id_join_request);
  }

  @Put('status')
  updateStatus(@Body() updateStatusDto: UpdateStatusClientRequestDto & { id_driver: number }) {
    return this.clientRequestsService.updateStatus(updateStatusDto.id_driver, updateStatusDto);
  }

  @Post(':id_trip/reviews')
  rateTrip(
    @Param('id_trip', ParseIntPipe) id_trip: number,
    @Body() body: { from_user_id: number; to_user_id: number; rating: number; review?: string },
  ) {
    return this.clientRequestsService.rateTrip({
      id_trip,
      from_user_id: body.from_user_id,
      to_user_id: body.to_user_id,
      rating: body.rating,
      review: body.review,
    });
  }
}
