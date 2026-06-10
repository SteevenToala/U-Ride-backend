import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripReservation } from './entities/trip-reservation.entity';
import { SharedTrip } from '../shared-trips/entities/shared-trip.entity';
import { PaypalService } from './paypal.service';

@Injectable()
export class TripReservationsService {
  constructor(
    @InjectRepository(TripReservation)
    private readonly reservationRepository: Repository<TripReservation>,
    @InjectRepository(SharedTrip)
    private readonly tripRepository: Repository<SharedTrip>,
    private readonly paypalService: PaypalService,
  ) {}

  async create(reservationData: any): Promise<TripReservation> {
    const trip = await this.tripRepository.findOne({ where: { id: reservationData.id_trip } });
    if (!trip) throw new NotFoundException('Trip not found');

    if (trip.id_driver === reservationData.id_passenger) {
      throw new BadRequestException('El conductor no puede reservar su propio viaje');
    }

    if (trip.available_seats < (reservationData.seats_requested || 1)) {
      throw new BadRequestException('Not enough available seats');
    }

    const paymentMethod = reservationData.payment_method || 'EFECTIVO';
    let paymentStatus = 'PENDIENTE';

    // Si el pago es con PayPal, verificamos la orden contra la API de PayPal antes de reservar
    if (paymentMethod === 'PAYPAL') {
      const paypalOrderId = reservationData.paypal_order_id;
      if (!paypalOrderId) {
        throw new BadRequestException('Falta el identificador de la orden de PayPal');
      }

      const { success, message } = await this.paypalService.verifyOrder(paypalOrderId);
      if (!success) {
        throw new BadRequestException(message);
      }
      paymentStatus = 'PAGADO';
    }

    const newReservation = this.reservationRepository.create({
      id_trip: reservationData.id_trip,
      id_passenger: reservationData.id_passenger,
      seats_requested: reservationData.seats_requested || 1,
      message: reservationData.message,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      paypal_order_id: paymentMethod === 'PAYPAL' ? reservationData.paypal_order_id : null,
    });
    return await this.reservationRepository.save(newReservation);
  }

  async getByTrip(idTrip: number): Promise<TripReservation[]> {
    return await this.reservationRepository.find({
      where: { id_trip: idTrip },
      relations: ['passenger', 'trip'],
      order: { created_at: 'DESC' },
    });
  }

  async getByPassenger(idPassenger: number): Promise<TripReservation[]> {
    return await this.reservationRepository.find({
      where: { id_passenger: idPassenger },
      relations: ['trip', 'trip.driver'],
      order: { created_at: 'DESC' },
    });
  }

  async updateStatus(id: number, status: string): Promise<TripReservation> {
    const reservation = await this.reservationRepository.findOne({ 
      where: { id },
      relations: ['trip']
    });
    
    if (!reservation) throw new NotFoundException('Reservation not found');

    // Un pasajero no puede cancelar si el viaje ya inició o finalizó
    if (status === 'CANCELLED') {
      const tripStatus = reservation.trip?.status;
      if (tripStatus === 'ACTIVE' || tripStatus === 'FINISHED') {
        throw new BadRequestException(
          'No se puede cancelar la reserva porque el viaje ya inició o finalizó'
        );
      }
    }

    // Handle seat availability logic
    if (status === 'ACCEPTED' && reservation.status !== 'ACCEPTED') {
      if (Number(reservation.trip.available_seats) < Number(reservation.seats_requested)) {
        throw new BadRequestException('Not enough seats to accept this reservation');
      }
      reservation.trip.available_seats = Number(reservation.trip.available_seats) - Number(reservation.seats_requested);
      await this.tripRepository.save(reservation.trip);
    } else if ((status === 'REJECTED' || status === 'CANCELLED') && reservation.status === 'ACCEPTED') {
      reservation.trip.available_seats = Number(reservation.trip.available_seats) + Number(reservation.seats_requested);
      await this.tripRepository.save(reservation.trip);
    }

    reservation.status = status;
    return await this.reservationRepository.save(reservation);
  }
}
