import { Controller, Post, Body, Get, Param, Put } from '@nestjs/common';
import { TripReservationsService } from './trip-reservations.service';

@Controller('trip-reservations')
export class TripReservationsController {
  constructor(private readonly reservationsService: TripReservationsService) {}

  @Post()
  async create(@Body() reservationData: any) {
    return await this.reservationsService.create(reservationData);
  }

  @Post('paypal/create-order')
  async createPaypalOrder(@Body('amount') amount: number) {
    return await this.reservationsService.createPaypalOrder(amount);
  }

  @Get('trip/:idTrip')
  async getByTrip(@Param('idTrip') idTrip: number) {
    return await this.reservationsService.getByTrip(idTrip);
  }

  @Get('passenger/:idPassenger')
  async getByPassenger(@Param('idPassenger') idPassenger: number) {
    return await this.reservationsService.getByPassenger(idPassenger);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() updateData: any) {
    return await this.reservationsService.update(id, updateData);
  }

  @Put(':id/accept')
  async accept(@Param('id') id: number) {
    return await this.reservationsService.updateStatus(id, 'ACCEPTED');
  }

  @Put(':id/reject')
  async reject(@Param('id') id: number) {
    return await this.reservationsService.updateStatus(id, 'REJECTED');
  }

  @Put(':id/cancel')
  async cancel(@Param('id') id: number) {
    return await this.reservationsService.updateStatus(id, 'CANCELLED');
  }

  @Put(':id/confirm-payment')
  async confirmPayment(@Param('id') id: number) {
    return await this.reservationsService.confirmPayment(id);
  }

  @Put(':id/pay-paypal')
  async payPaypal(@Param('id') id: number, @Body('paypal_order_id') paypalOrderId: string) {
    return await this.reservationsService.payPaypal(id, paypalOrderId);
  }
}
