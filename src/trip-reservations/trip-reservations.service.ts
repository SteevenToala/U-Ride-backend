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
    const paymentStatus = 'PENDIENTE';
    const reservationStatus = 'PENDING';

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validar RN1: Una reserva activa por estudiante
      // Buscamos si el pasajero tiene otra reserva activa (PENDING o ACCEPTED) en un viaje no finalizado ni cancelado
      const activeReservation = await queryRunner.manager
        .getRepository(TripReservation)
        .createQueryBuilder('res')
        .innerJoinAndSelect('res.trip', 'trip')
        .where('res.id_passenger = :passengerId', { passengerId: reservationData.id_passenger })
        .andWhere('res.status IN (:...statuses)', { statuses: ['PENDING', 'ACCEPTED'] })
        .andWhere('trip.status NOT IN (:...tripStatuses)', { tripStatuses: ['FINISHED', 'CANCELLED'] })
        .getOne();

      if (activeReservation) {
        throw new BadRequestException(
          'Ya tienes una reserva activa para otro viaje. Debes cancelarla o esperar a que finalice para poder reservar otro viaje.'
        );
      }

      // 2. Obtener el viaje con bloqueo pesimista de escritura para evitar condiciones de carrera (concurrencia)
      const trip = await queryRunner.manager
        .getRepository(SharedTrip)
        .createQueryBuilder('trip')
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

      // 3. Crear la reserva en estado PENDING y payment_status PENDIENTE (los cupos se restan al pagar)
      const newReservation = queryRunner.manager.create(TripReservation, {
        id_trip: reservationData.id_trip,
        id_passenger: reservationData.id_passenger,
        seats_requested: seatsRequested,
        meeting_point: reservationData.meeting_point,
        message: reservationData.message,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        status: reservationStatus,
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

  /**
   * RN2: Modificación de reserva.
   * El pasajero puede editar una solicitud únicamente mientras esté en estado Pendiente.
   */
  async update(id: number, updateData: any): Promise<TripReservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
    });

    if (!reservation) throw new NotFoundException('Reserva no encontrada');

    if (reservation.status !== 'PENDING') {
      throw new BadRequestException('Únicamente se pueden editar solicitudes de reserva en estado PENDIENTE');
    }

    // Permitir modificar: punto de encuentro, observaciones (message), método de pago
    if (updateData.meeting_point !== undefined) {
      reservation.meeting_point = updateData.meeting_point;
    }
    if (updateData.message !== undefined) {
      reservation.message = updateData.message;
    }
    if (updateData.payment_method !== undefined) {
      reservation.payment_method = updateData.payment_method;
    }

    const saved = await this.reservationRepository.save(reservation);
    return await this.reservationRepository.findOne({
      where: { id: saved.id },
      relations: ['passenger', 'trip'],
    });
  }

  /**
   * Paga y confirma una reserva ACCEPTED mediante PayPal.
   * Captura el dinero de PayPal de forma transaccional y descuenta los cupos de la base de datos.
   */
  async payPaypal(id: number, paypalOrderId: string): Promise<TripReservation> {
    const { success, message } = await this.paypalService.verifyOrder(paypalOrderId);
    if (!success) {
      throw new BadRequestException(message);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reservation = await queryRunner.manager.findOne(TripReservation, {
        where: { id },
        relations: ['trip'],
      });

      if (!reservation) throw new NotFoundException('Reserva no encontrada');
      if (reservation.status !== 'ACCEPTED') {
        throw new BadRequestException('Solo se pueden pagar reservas que hayan sido ACEPTADAS por el conductor');
      }
      if (reservation.payment_status === 'PAGADO') {
        throw new BadRequestException('Esta reserva ya se encuentra pagada');
      }

      reservation.payment_status = 'PAGADO';
      reservation.paypal_order_id = paypalOrderId;

      const updatedReservation = await queryRunner.manager.save(TripReservation, reservation);
      await queryRunner.commitTransaction();

      // Recargar relaciones
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
        .getRepository(SharedTrip)
        .createQueryBuilder('trip')
        .setLock('pessimistic_write')
        .where('trip.id = :id', { id: reservation.id_trip })
        .getOne();

      if (!trip) throw new NotFoundException('Trip not found');

      // Aceptar reserva
      if (status === 'ACCEPTED' && reservation.status !== 'ACCEPTED') {
        if (Number(trip.available_seats) < Number(reservation.seats_requested)) {
          throw new BadRequestException('No quedan suficientes cupos en el viaje para aceptar esta solicitud.');
        }
        trip.available_seats = Number(trip.available_seats) - Number(reservation.seats_requested);
        await queryRunner.manager.save(SharedTrip, trip);
      } 
      // Cancelar / Rechazar reserva que ya estaba aceptada
      else if ((status === 'REJECTED' || status === 'CANCELLED') && reservation.status === 'ACCEPTED') {
        trip.available_seats = Number(trip.available_seats) + Number(reservation.seats_requested);
        await queryRunner.manager.save(SharedTrip, trip);
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

      reservation.payment_status = 'PAGADO';

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
