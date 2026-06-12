import { Test, TestingModule } from '@nestjs/testing';
import { TripReservationsService } from './trip-reservations.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TripReservation } from './entities/trip-reservation.entity';
import { SharedTrip } from '../shared-trips/entities/shared-trip.entity';
import { PaypalService } from './paypal.service';
import { Repository, DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.setTimeout(30000);

describe('TripReservationsService (Unit Tests)', () => {
  let service: TripReservationsService;
  let paypalService: PaypalService;

  const mockReservationRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const mockTripRepo = {};

  const mockPaypalService = {
    verifyOrder: jest.fn(),
  };

  // Mocks para el flujo de transacciones con QueryRunner
  const mockQueryBuilder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockQueryRunnerManager = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    getRepository: jest.fn(() => mockRepository),
  };

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(null),
    startTransaction: jest.fn().mockResolvedValue(null),
    commitTransaction: jest.fn().mockResolvedValue(null),
    rollbackTransaction: jest.fn().mockResolvedValue(null),
    release: jest.fn().mockResolvedValue(null),
    manager: mockQueryRunnerManager,
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripReservationsService,
        {
          provide: getRepositoryToken(TripReservation),
          useValue: mockReservationRepo,
        },
        {
          provide: getRepositoryToken(SharedTrip),
          useValue: mockTripRepo,
        },
        {
          provide: PaypalService,
          useValue: mockPaypalService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TripReservationsService>(TripReservationsService);
    paypalService = module.get<PaypalService>(PaypalService);

    jest.clearAllMocks();
    mockQueryBuilder.getOne.mockReset();
    mockQueryBuilder.getOne.mockResolvedValue(null); // por defecto no hay reservas activas
  });

  describe('create - Solicitud de Reserva (RF-005)', () => {
    const mockTrip = {
      id: 1,
      id_driver: 10,
      origin: 'Ficoa',
      destination: 'Campus Huachi',
      available_seats: 3,
      price: 0.50,
      status: 'PENDING',
    };

    it('debe lanzar NotFoundException si el viaje no existe', async () => {
      // Primera llamada: activeReservation = null
      mockQueryBuilder.getOne.mockResolvedValueOnce(null);
      // Segunda llamada: trip = null
      mockQueryBuilder.getOne.mockResolvedValueOnce(null);

      await expect(
        service.create({ id_trip: 999, id_passenger: 2 }),
      ).rejects.toThrow(new NotFoundException('Trip not found'));
    });

    it('debe lanzar BadRequestException si el pasajero ya tiene una reserva activa (RN1)', async () => {
      const activeReservation = { id: 5, id_passenger: 2, status: 'PENDING' };
      // Primera llamada devuelve una reserva activa
      mockQueryBuilder.getOne.mockResolvedValueOnce(activeReservation);

      await expect(
        service.create({ id_trip: 1, id_passenger: 2 }),
      ).rejects.toThrow(
        new BadRequestException(
          'Ya tienes una reserva activa para otro viaje. Debes cancelarla o esperar a que finalice para poder reservar otro viaje.',
        ),
      );
    });

    it('debe lanzar BadRequestException si el conductor intenta reservar su propio viaje', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce(null); // activeReservation
      mockQueryBuilder.getOne.mockResolvedValueOnce(mockTrip); // trip

      await expect(
        service.create({ id_trip: 1, id_passenger: 10 }), // Pasajero es el conductor
      ).rejects.toThrow(new BadRequestException('El conductor no puede reservar su propio viaje'));
    });

    it('debe lanzar BadRequestException si no hay suficientes asientos disponibles', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce(null); // activeReservation
      mockQueryBuilder.getOne.mockResolvedValueOnce(mockTrip); // trip (tiene 3 asientos)

      await expect(
        service.create({ id_trip: 1, id_passenger: 2, seats_requested: 5 }),
      ).rejects.toThrow(new BadRequestException('Not enough available seats'));
    });

    it('debe reservar con éxito en estado PENDING y PENDIENTE (Caso Positivo)', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce(null); // activeReservation
      mockQueryBuilder.getOne.mockResolvedValueOnce(mockTrip); // trip

      const reservationPayload = {
        id_trip: 1,
        id_passenger: 2,
        seats_requested: 1,
        message: 'Llevo equipaje',
        meeting_point: 'Esquina parque',
      };

      const expectedReservation = {
        id: 99,
        ...reservationPayload,
        payment_method: 'EFECTIVO',
        payment_status: 'PENDIENTE',
        status: 'PENDING',
      };

      mockQueryRunnerManager.create.mockReturnValue(expectedReservation);
      mockQueryRunnerManager.save.mockResolvedValue(expectedReservation);

      const result = await service.create(reservationPayload);

      expect(result.status).toBe('PENDING');
      expect(result.payment_status).toBe('PENDIENTE');
      expect(mockQueryRunnerManager.save).toHaveBeenCalled();
    });
  });

  describe('update - Modificación de reserva (RN2)', () => {
    it('debe actualizar campos si la reserva está en PENDING', async () => {
      const existingReservation = {
        id: 1,
        status: 'PENDING',
        meeting_point: 'Viejo punto',
        message: 'Sin comentarios',
        payment_method: 'EFECTIVO',
      };

      mockReservationRepo.findOne
        .mockResolvedValueOnce(existingReservation)
        .mockResolvedValueOnce({
          ...existingReservation,
          meeting_point: 'Nuevo punto',
          payment_method: 'PAYPAL',
        });

      mockReservationRepo.save.mockImplementation(async (res) => res);

      const result = await service.update(1, {
        meeting_point: 'Nuevo punto',
        payment_method: 'PAYPAL',
      });

      expect(result.meeting_point).toBe('Nuevo punto');
      expect(result.payment_method).toBe('PAYPAL');
      expect(mockReservationRepo.save).toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si la reserva no está en PENDING', async () => {
      const acceptedReservation = { id: 1, status: 'ACCEPTED' };
      mockReservationRepo.findOne.mockResolvedValueOnce(acceptedReservation);

      await expect(
        service.update(1, { meeting_point: 'Nuevo punto' }),
      ).rejects.toThrow(
        new BadRequestException('Únicamente se pueden editar solicitudes de reserva en estado PENDIENTE'),
      );
    });
  });

  describe('payPaypal - Pago post-aceptación', () => {
    const mockTrip = {
      id: 1,
      available_seats: 3,
    };

    it('debe capturar el pago, restar cupos y marcar como PAGADO', async () => {
      mockPaypalService.verifyOrder.mockResolvedValueOnce({ success: true, message: 'Pago completado' });

      const reservation = {
        id: 1,
        id_trip: 1,
        seats_requested: 1,
        status: 'ACCEPTED',
        payment_status: 'PENDIENTE',
        paypal_order_id: null,
      };

      mockQueryRunnerManager.findOne.mockResolvedValueOnce(reservation);
      mockQueryBuilder.getOne.mockResolvedValueOnce(mockTrip);
      mockReservationRepo.findOne.mockResolvedValueOnce({
        ...reservation,
        payment_status: 'PAGADO',
        paypal_order_id: 'PAY-12345',
      });

      const result = await service.payPaypal(1, 'PAY-12345');

      expect(result.payment_status).toBe('PAGADO');
      expect(result.paypal_order_id).toBe('PAY-12345');
      expect(mockQueryRunnerManager.save).toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si el pago de PayPal falla', async () => {
      mockPaypalService.verifyOrder.mockResolvedValueOnce({ success: false, message: 'Pago no autorizado' });

      await expect(
        service.payPaypal(1, 'PAY-FAIL'),
      ).rejects.toThrow(new BadRequestException('Pago no autorizado'));
    });
  });
});
