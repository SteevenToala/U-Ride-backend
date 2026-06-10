import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
  ) {}

  async createPaypalOrder(amount: number) {
    return await this.paypalService.createOrder(amount);
  }

  async create(reservationData: any): Promise<TripReservation> {
    const seatsRequested = reservationData.seats_requested || 1;
    const paymentMethod = reservationData.payment_method || 'EFECTIVO';
    let paymentStatus = 'PENDIENTE';
    let reservationStatus = 'PENDING';

    // 1. Si el pago es con PayPal, se verifica y cobra antes de realizar la reserva
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
      reservationStatus = 'ACCEPTED'; // Las reservas pagadas se aprueban automáticamente
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Obtener el viaje con bloqueo pesimista de escritura para evitar condiciones de carrera (concurrencia)
      const trip = await queryRunner.manager
        .createQueryBuilder(SharedTrip, 'trip')
        .setLock('pessimistic_write')
        .where('trip.id = :id', { id: reservationData.id_trip })
        .getOne();

      if (!trip) throw new NotFoundException('Trip not found');

      if (trip.id_driver === reservationData.id_passenger) {
        throw new BadRequestException('El conductor no puede reservar su propio viaje');
      }

      if (trip.available_seats < seatsRequested) {
        throw new BadRequestException('Not enough available seats');
      }

      // 3. Si es PayPal (ya pagado), descontamos los asientos inmediatamente de la base de datos
      if (paymentMethod === 'PAYPAL') {
        trip.available_seats = Number(trip.available_seats) - seatsRequested;
        await queryRunner.manager.save(SharedTrip, trip);
      }

      const newReservation = queryRunner.manager.create(TripReservation, {
        id_trip: reservationData.id_trip,
        id_passenger: reservationData.id_passenger,
        seats_requested: seatsRequested,
        message: reservationData.message,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        status: reservationStatus,
        paypal_order_id: paymentMethod === 'PAYPAL' ? reservationData.paypal_order_id : null,
      });

      const savedReservation = await queryRunner.manager.save(TripReservation, newReservation);
      await queryRunner.commitTransaction();
      return savedReservation;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reservation = await queryRunner.manager.findOne(TripReservation, {
        where: { id },
        relations: ['trip'],
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

      const trip = await queryRunner.manager
        .createQueryBuilder(SharedTrip, 'trip')
        .setLock('pessimistic_write')
        .where('trip.id = :id', { id: reservation.id_trip })
        .getOne();

      if (!trip) throw new NotFoundException('Trip not found');

      // Aceptar reserva
      if (status === 'ACCEPTED' && reservation.status !== 'ACCEPTED') {
        // En efectivo, el chofer la acepta pero no descontamos cupos hasta que se pague (o si el usuario pide descontar al aceptar)
        // Para mayor claridad: al aceptar en EFECTIVO dejamos la reserva como aceptada pero con cupos intactos hasta que pague.
        // Pero para asegurar disponibilidad tentativa, validamos que queden cupos
        if (Number(trip.available_seats) < Number(reservation.seats_requested)) {
          throw new BadRequestException('Not enough seats to accept this reservation');
        }
        // Nota: Solo se restan de available_seats al pagar.
      } 
      // Cancelar / Rechazar reserva que ya estaba aceptada o pagada
      else if ((status === 'REJECTED' || status === 'CANCELLED') && reservation.status === 'ACCEPTED') {
        // Solo restauramos cupos si la reserva ya estaba cobrada/pagada (es decir, ya había restado cupos)
        if (reservation.payment_status === 'PAGADO') {
          trip.available_seats = Number(trip.available_seats) + Number(reservation.seats_requested);
          await queryRunner.manager.save(SharedTrip, trip);
        }
      }

      reservation.status = status;
      const updatedReservation = await queryRunner.manager.save(TripReservation, reservation);
      await queryRunner.commitTransaction();

      // Recargar la reserva con sus relaciones completas para evitar pérdidas de datos en el cliente
      const reloaded = await this.reservationRepository.findOne({
        where: { id: updatedReservation.id },
        relations: ['passenger', 'trip'],
      });
      return reloaded || updatedReservation;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Confirma el pago de una reserva (útil para pagos en efectivo validados por el chochofer).
   * Cuando se confirma el pago, recién en este punto se descuentan los cupos del viaje.
   */
  async confirmPayment(id: number): Promise<TripReservation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reservation = await queryRunner.manager.findOne(TripReservation, {
        where: { id },
        relations: ['trip'],
      });

      if (!reservation) throw new NotFoundException('Reserva no encontrada');
      if (reservation.payment_status === 'PAGADO') {
        throw new BadRequestException('Esta reserva ya se encuentra pagada');
      }

      const trip = await queryRunner.manager
        .createQueryBuilder(SharedTrip, 'trip')
        .setLock('pessimistic_write')
        .where('trip.id = :id', { id: reservation.id_trip })
        .getOne();

      if (!trip) throw new NotFoundException('Viaje correspondiente no encontrado');

      // Validar disponibilidad de cupos antes de confirmar el pago
      if (Number(trip.available_seats) < Number(reservation.seats_requested)) {
        throw new BadRequestException('No quedan suficientes cupos en el viaje para registrar este pago');
      }

      // Descontar cupos de forma definitiva
      trip.available_seats = Number(trip.available_seats) - Number(reservation.seats_requested);
      await queryRunner.manager.save(SharedTrip, trip);

      reservation.payment_status = 'PAGADO';
      // Si el pago se confirma y estaba pendiente de aceptación, la aceptamos automáticamente
      if (reservation.status === 'PENDING') {
        reservation.status = 'ACCEPTED';
      }

      const updatedReservation = await queryRunner.manager.save(TripReservation, reservation);
      await queryRunner.commitTransaction();

      // Recargar la reserva con relaciones completas
      const reloaded = await this.reservationRepository.findOne({
        where: { id: updatedReservation.id },
        relations: ['passenger', 'trip'],
      });
      return reloaded || updatedReservation;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
