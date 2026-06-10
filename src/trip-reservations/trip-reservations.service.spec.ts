import { Test, TestingModule } from '@nestjs/testing';
import { TripReservationsService } from './trip-reservations.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TripReservation } from './entities/trip-reservation.entity';
import { SharedTrip } from '../shared-trips/entities/shared-trip.entity';
import { PaypalService } from './paypal.service';
import { Repository, DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TripReservationsService (Unit Tests)', () => {
  let service: TripReservationsService;
  let paypalService: PaypalService;

  const mockReservationRepo = {};
  const mockTripRepo = {};

  const mockPaypalService = {
    verifyOrder: jest.fn(),
  };

  // Mocks para el flujo de transacciones con QueryRunner
  const mockQueryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const mockQueryRunnerManager = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
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
      mockQueryBuilder.getOne.mockResolvedValueOnce(null);

      await expect(
        service.create({ id_trip: 999, id_passenger: 2 }),
      ).rejects.toThrow(new NotFoundException('Trip not found'));
    });

    it('debe lanzar BadRequestException si el conductor intenta reservar su propio viaje', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce(mockTrip);

      await expect(
        service.create({ id_trip: 1, id_passenger: 10 }), // Pasajero es el mismo conductor (10)
      ).rejects.toThrow(new BadRequestException('El conductor no puede reservar su propio viaje'));
    });

    it('debe lanzar BadRequestException si no hay suficientes asientos disponibles', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce(mockTrip);

      await expect(
        service.create({ id_trip: 1, id_passenger: 2, seats_requested: 5 }), // Pide 5, hay 3
      ).rejects.toThrow(new BadRequestException('Not enough available seats'));
    });

    it('debe reservar con éxito en EFECTIVO por defecto (Caso Positivo)', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce(mockTrip);
      
      const reservationPayload = {
        id_trip: 1,
        id_passenger: 2,
        seats_requested: 1,
        message: 'Llevo maleta',
      };

      const expectedReservation = {
        ...reservationPayload,
        payment_method: 'EFECTIVO',
        payment_status: 'PENDIENTE',
        paypal_order_id: null,
      };

      mockQueryRunnerManager.create.mockReturnValue(expectedReservation);
      mockQueryRunnerManager.save.mockResolvedValue(expectedReservation);

      const result = await service.create(reservationPayload);

      expect(result.payment_method).toBe('EFECTIVO');
      expect(result.payment_status).toBe('PENDIENTE');
      expect(mockQueryRunnerManager.save).toHaveBeenCalled();
    });

    it('debe reservar con éxito usando PAYPAL si se provee una orden válida (Caso Positivo)', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce(mockTrip);
      mockPaypalService.verifyOrder.mockResolvedValueOnce({ success: true, message: 'Pago completado' });

      const reservationPayload = {
        id_trip: 1,
        id_passenger: 2,
        seats_requested: 1,
        payment_method: 'PAYPAL',
        paypal_order_id: 'ORDER-PAYPAL-123',
      };

      const expectedReservation = {
        ...reservationPayload,
        payment_status: 'PAGADO',
      };

      mockQueryRunnerManager.create.mockReturnValue(expectedReservation);
      mockQueryRunnerManager.save.mockResolvedValue(expectedReservation);

      const result = await service.create(reservationPayload);

      expect(result.payment_method).toBe('PAYPAL');
      expect(result.payment_status).toBe('PAGADO');
      expect(result.paypal_order_id).toBe('ORDER-PAYPAL-123');
      expect(mockPaypalService.verifyOrder).toHaveBeenCalledWith('ORDER-PAYPAL-123');
      expect(mockQueryRunnerManager.save).toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException en PAYPAL si falta el paypal_order_id', async () => {
      const reservationPayload = {
        id_trip: 1,
        id_passenger: 2,
        seats_requested: 1,
        payment_method: 'PAYPAL', // Falta paypal_order_id
      };

      await expect(service.create(reservationPayload)).rejects.toThrow(
        new BadRequestException('Falta el identificador de la orden de PayPal'),
      );
    });

    it('debe lanzar BadRequestException en PAYPAL si la verificación de la orden falla', async () => {
      mockPaypalService.verifyOrder.mockResolvedValueOnce({
        success: false,
        message: 'El pago no fue completado en PayPal.',
      });

      const reservationPayload = {
        id_trip: 1,
        id_passenger: 2,
        seats_requested: 1,
        payment_method: 'PAYPAL',
        paypal_order_id: 'INVALID-ORDER',
      };

      await expect(service.create(reservationPayload)).rejects.toThrow(
        new BadRequestException('El pago no fue completado en PayPal.'),
      );
    });
  });
});
